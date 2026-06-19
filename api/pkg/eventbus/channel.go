package eventbus

import (
	"sync"

	"api/pkg/log"
)

const defaultBufferSize = 256

type subscription struct {
	ch        chan Event
	kinds     map[EventKind]struct{}
	sessionID string
	saveName  string
	dataType  string
}

func (s *subscription) wants(e Event) bool {
	if _, ok := s.kinds[e.Kind]; !ok {
		return false
	}
	if s.sessionID != "" && e.SessionID != "" && s.sessionID != e.SessionID {
		return false
	}
	if s.saveName != "" && e.SaveName != "" && s.saveName != e.SaveName {
		return false
	}
	if s.dataType != "" && e.DataType != "" && s.dataType != e.DataType {
		return false
	}
	return true
}

// ChannelBus is the in-process fan-out implementation of Bus. Publish is a
// non-blocking send to every matching subscriber; a full subscriber drops the
// newest event rather than blocking the publisher.
type ChannelBus struct {
	mu         sync.RWMutex
	bufferSize int
	subs       map[<-chan Event]*subscription
}

// NewChannelBus returns an empty bus with the default per-subscriber buffer.
func NewChannelBus() *ChannelBus {
	return &ChannelBus{
		bufferSize: defaultBufferSize,
		subs:       make(map[<-chan Event]*subscription),
	}
}

// Publish fans out to every subscriber whose filter matches, dropping the event
// for any subscriber whose buffer is full.
func (b *ChannelBus) Publish(event Event) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, sub := range b.subs {
		if !sub.wants(event) {
			continue
		}
		select {
		case sub.ch <- event:
		default:
			log.Debugf("eventbus: dropping %s event for full subscriber", event.Kind)
		}
	}
}

// Subscribe returns a channel receiving every event of the named kinds.
func (b *ChannelBus) Subscribe(kinds ...EventKind) <-chan Event {
	return b.subscribe("", "", "", kinds)
}

// SubscribeSession returns a channel pinned to one session across the kinds.
func (b *ChannelBus) SubscribeSession(sessionID string, kinds ...EventKind) <-chan Event {
	return b.subscribe(sessionID, "", "", kinds)
}

// SubscribeDomain returns a channel pinned to one (session, save, dataType) on
// the KindSatisfactory kind.
func (b *ChannelBus) SubscribeDomain(sessionID, saveName, dataType string) <-chan Event {
	return b.subscribe(sessionID, saveName, dataType, []EventKind{KindSatisfactory})
}

func (b *ChannelBus) subscribe(sessionID, saveName, dataType string, kinds []EventKind) <-chan Event {
	ch := make(chan Event, b.bufferSize)
	set := make(map[EventKind]struct{}, len(kinds))
	for _, k := range kinds {
		set[k] = struct{}{}
	}
	b.mu.Lock()
	b.subs[ch] = &subscription{
		ch:        ch,
		kinds:     set,
		sessionID: sessionID,
		saveName:  saveName,
		dataType:  dataType,
	}
	b.mu.Unlock()
	return ch
}

// Unsubscribe deregisters ch and closes it so the consumer's range/ok loop ends.
func (b *ChannelBus) Unsubscribe(ch <-chan Event) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if sub, ok := b.subs[ch]; ok {
		delete(b.subs, ch)
		close(sub.ch)
	}
}
