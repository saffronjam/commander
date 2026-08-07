package frm_client

import (
	"api/models/models"
	"context"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"
)

// DefaultPort is the port FRM listens on unless the operator changed it.
const DefaultPort = 8080

const (
	// scanProbeTimeout bounds one probe. FRM answers a LAN request in well under
	// 50ms, so this is headroom for a busy game server rather than a real budget.
	scanProbeTimeout = 600 * time.Millisecond
	// scanConcurrency keeps a subnet sweep to a few seconds without opening a
	// socket per host at once.
	scanConcurrency = 96
	// maxScanProbes bounds the work a single request can ask for.
	maxScanProbes = 1024
)

// ErrNoPrivateNetwork means neither the caller nor the server could be placed on
// a private network, so there is nothing safe to scan.
var ErrNoPrivateNetwork = errors.New("could not work out which network to search")

// ErrScanTooLarge means the derived target list was bigger than one request is
// allowed to sweep.
var ErrScanTooLarge = errors.New("the network is too large to search")

// scanMu serializes sweeps. One scan at a time keeps the endpoint from being used
// to amplify traffic, and a second caller waits for the first rather than being
// refused.
var scanMu sync.Mutex

// DiscoverTargets derives the addresses worth probing for a caller.
//
// Every safety rule lives here rather than in the sweep: only private IPv4 space
// is ever considered, so a spoofed forwarded header cannot aim the scan at the
// internet, and the total is capped. Keeping the guards separate from the sweep is
// also what lets the sweep be tested against loopback.
func DiscoverTargets(clientIP string, ports []int) ([]string, error) {
	prefixes := candidatePrefixes(clientIP)
	if len(prefixes) == 0 {
		return nil, ErrNoPrivateNetwork
	}

	ports = candidatePorts(ports)
	if total := len(prefixes) * 254 * len(ports); total > maxScanProbes {
		return nil, fmt.Errorf("%w: %d addresses is more than the %d this can sweep", ErrScanTooLarge, total, maxScanProbes)
	}

	targets := make([]string, 0, len(prefixes)*254*len(ports))
	for _, prefix := range prefixes {
		base := prefix.Addr().As4()
		for host := 1; host < 255; host++ {
			addr := netip.AddrFrom4([4]byte{base[0], base[1], base[2], byte(host)})
			for _, port := range ports {
				targets = append(targets, net.JoinHostPort(addr.String(), strconv.Itoa(port)))
			}
		}
	}
	return targets, nil
}

// maxFallbackPrefixes bounds the guess made when the caller's own network is
// unknown. A developer machine typically has several private interfaces from
// container bridges, and sweeping all of them is neither fast nor useful.
const maxFallbackPrefixes = 2

// candidatePrefixes decides which /24s to sweep.
//
// The caller's own network is authoritative when it is known: the player is by
// definition on the same network as the game, while the dashboard may be a
// container on an address space of its own. Only when the caller cannot be placed
// — a loopback request, or an address that does not parse — does this fall back to
// the server's own interfaces.
//
// Always a /24 regardless of the real mask, because a /16 is 65k addresses and not
// sweepable.
func candidatePrefixes(clientIP string) []netip.Prefix {
	if addr, err := netip.ParseAddr(strings.TrimSpace(clientIP)); err == nil {
		if prefix, ok := privatePrefix(addr.Unmap()); ok {
			return []netip.Prefix{prefix}
		}
	}

	var prefixes []netip.Prefix
	for _, addr := range localPrivateAddrs() {
		if prefix, ok := privatePrefix(addr); ok && !slices.Contains(prefixes, prefix) {
			prefixes = append(prefixes, prefix)
		}
	}

	// Container bridges live in 172.16/12 by default, so a real LAN is more likely
	// to be one of the other two private ranges.
	slices.SortStableFunc(prefixes, func(a, b netip.Prefix) int {
		return privateRangeRank(a.Addr()) - privateRangeRank(b.Addr())
	})
	if len(prefixes) > maxFallbackPrefixes {
		prefixes = prefixes[:maxFallbackPrefixes]
	}
	return prefixes
}

// privatePrefix reduces a private IPv4 address to its /24.
func privatePrefix(addr netip.Addr) (netip.Prefix, bool) {
	if !addr.Is4() || !addr.IsPrivate() {
		return netip.Prefix{}, false
	}
	prefix, err := addr.Prefix(24)
	if err != nil {
		return netip.Prefix{}, false
	}
	return prefix, true
}

// privateRangeRank orders the private ranges by how likely they are to be a home
// or office LAN rather than a container bridge.
func privateRangeRank(addr netip.Addr) int {
	switch b := addr.As4(); {
	case b[0] == 192:
		return 0
	case b[0] == 10:
		return 1
	default:
		return 2
	}
}

// localPrivateAddrs reports the server's own private IPv4 addresses.
func localPrivateAddrs() []netip.Addr {
	ifaces, err := net.Interfaces()
	if err != nil {
		return nil
	}

	var out []netip.Addr
	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, a := range addrs {
			ipNet, ok := a.(*net.IPNet)
			if !ok {
				continue
			}
			if addr, ok := netip.AddrFromSlice(ipNet.IP); ok {
				out = append(out, addr.Unmap())
			}
		}
	}
	return out
}

// candidatePorts puts FRM's default first and adds any others already in use,
// since someone running two servers usually runs them on the same port.
func candidatePorts(extra []int) []int {
	ports := []int{DefaultPort}
	for _, port := range extra {
		if port > 0 && port < 65536 && !slices.Contains(ports, port) {
			ports = append(ports, port)
		}
	}
	return ports
}

// ScanForServers probes every target and returns those that answered as FRM.
// A probe that answers with a save name is proof, so there are no false positives
// to filter afterwards.
func ScanForServers(ctx context.Context, targets []string) []models.DiscoveredServer {
	scanMu.Lock()
	defer scanMu.Unlock()

	var (
		mu    sync.Mutex
		found []models.DiscoveredServer
		wg    sync.WaitGroup
	)
	slots := make(chan struct{}, scanConcurrency)

	for _, target := range targets {
		if ctx.Err() != nil {
			break
		}
		wg.Add(1)
		go func(address string) {
			defer wg.Done()
			slots <- struct{}{}
			defer func() { <-slots }()

			if ctx.Err() != nil {
				return
			}
			probeCtx, cancel := context.WithTimeout(ctx, scanProbeTimeout)
			defer cancel()

			// The probe's own timeout is a child of this one, so the shorter
			// deadline here wins and a sweep is not paced by it.
			info, err := ProbeSessionInfo(probeCtx, address)
			if err != nil {
				return
			}

			mu.Lock()
			found = append(found, models.DiscoveredServer{Address: address, Info: *info})
			mu.Unlock()
		}(target)
	}
	wg.Wait()

	slices.SortFunc(found, func(a, b models.DiscoveredServer) int {
		return strings.Compare(a.Address, b.Address)
	})
	return found
}

// PortOf reports the port an address names, or 0 when it names none.
func PortOf(address string) int {
	_, port, err := net.SplitHostPort(NormalizeAddress(address))
	if err != nil {
		return 0
	}
	n, err := strconv.Atoi(port)
	if err != nil {
		return 0
	}
	return n
}

// NormalizeAddress reduces an address to a comparable form. Session addresses are
// stored exactly as they were typed, so the same server can already be recorded as
// "host:port", "http://host:port" or with a trailing slash; comparing the raw
// strings would miss those.
func NormalizeAddress(address string) string {
	address = strings.TrimSpace(strings.ToLower(address))
	address = strings.TrimPrefix(strings.TrimPrefix(address, "https://"), "http://")
	address = strings.TrimSuffix(address, "/")
	if host, port, err := net.SplitHostPort(address); err == nil {
		return net.JoinHostPort(host, port)
	}
	return address
}
