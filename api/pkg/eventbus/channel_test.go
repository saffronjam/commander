package eventbus_test

import (
	"sync"
	"testing"
	"time"

	"api/pkg/eventbus"
)

func satEvent(sessionID, dataType string) eventbus.Event {
	return eventbus.Event{
		Kind:      eventbus.KindSatisfactory,
		SessionID: sessionID,
		DataType:  dataType,
		Payload:   eventbus.SatisfactoryEvent{SessionID: sessionID, DataType: dataType},
	}
}

func TestFanoutToAllSubscribers(t *testing.T) {
	b := eventbus.NewChannelBus()
	chs := []<-chan eventbus.Event{
		b.Subscribe(eventbus.KindSatisfactory),
		b.Subscribe(eventbus.KindSatisfactory),
		b.Subscribe(eventbus.KindSatisfactory),
	}
	b.Publish(satEvent("s1", "circuits"))
	for i, ch := range chs {
		select {
		case e := <-ch:
			if e.DataType != "circuits" {
				t.Fatalf("sub %d: wrong event %+v", i, e)
			}
		case <-time.After(time.Second):
			t.Fatalf("sub %d: did not receive event", i)
		}
	}
}

func TestKindFilter(t *testing.T) {
	b := eventbus.NewChannelBus()
	conn := b.SubscribeSession("s1", eventbus.KindConnectivity)
	b.Publish(satEvent("s1", "circuits")) // wrong kind
	select {
	case e := <-conn:
		t.Fatalf("connectivity sub received non-connectivity event %+v", e)
	case <-time.After(50 * time.Millisecond):
	}
}

func TestSubscribeDomainPinsSessionAndType(t *testing.T) {
	b := eventbus.NewChannelBus()
	ch := b.SubscribeDomain("s1", "circuits")

	b.Publish(satEvent("s2", "circuits")) // wrong session
	b.Publish(satEvent("s1", "players"))  // wrong type
	select {
	case e := <-ch:
		t.Fatalf("domain sub received mismatched event %+v", e)
	case <-time.After(50 * time.Millisecond):
	}

	b.Publish(satEvent("s1", "circuits")) // exact match
	select {
	case e := <-ch:
		if e.SessionID != "s1" || e.DataType != "circuits" {
			t.Fatalf("unexpected event %+v", e)
		}
	case <-time.After(time.Second):
		t.Fatal("domain sub did not receive matching event")
	}
}

func TestUnsubscribeClosesChannel(t *testing.T) {
	b := eventbus.NewChannelBus()
	ch := b.Subscribe(eventbus.KindSatisfactory)
	b.Unsubscribe(ch)
	select {
	case _, ok := <-ch:
		if ok {
			t.Fatal("expected closed channel after Unsubscribe")
		}
	case <-time.After(time.Second):
		t.Fatal("channel not closed after Unsubscribe")
	}
}

func TestDropOnFullNeverBlocks(t *testing.T) {
	b := eventbus.NewChannelBus()
	ch := b.Subscribe(eventbus.KindSatisfactory)

	const published = 1000
	done := make(chan struct{})
	go func() {
		for range published {
			b.Publish(satEvent("s1", "circuits"))
		}
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a full subscriber")
	}

	drained := 0
	for {
		select {
		case <-ch:
			drained++
		default:
			if drained == 0 {
				t.Fatal("expected some buffered events")
			}
			if drained >= published {
				t.Fatalf("expected drop-on-full, drained %d of %d", drained, published)
			}
			return
		}
	}
}

func TestConcurrentPublishSubscribe(t *testing.T) {
	b := eventbus.NewChannelBus()
	var wg sync.WaitGroup

	for range 8 {
		wg.Go(func() {
			for range 200 {
				b.Publish(satEvent("s1", "circuits"))
			}
		})
	}
	for range 8 {
		wg.Go(func() {
			for range 50 {
				ch := b.Subscribe(eventbus.KindSatisfactory)
				select {
				case <-ch:
				default:
				}
				b.Unsubscribe(ch)
			}
		})
	}
	wg.Wait()
}

func TestLatestStorePutGetClear(t *testing.T) {
	s := eventbus.NewLatestStore()
	s.Put(eventbus.SatisfactoryEvent{SessionID: "s1", DataType: "circuits", GameTimeID: 1})
	s.Put(eventbus.SatisfactoryEvent{SessionID: "s1", DataType: "players", GameTimeID: 2})
	s.Put(eventbus.SatisfactoryEvent{SessionID: "s1", DataType: "circuits", GameTimeID: 3}) // overwrite

	got, ok := s.Get("s1", "circuits")
	if !ok || got.GameTimeID != 3 {
		t.Fatalf("want latest circuits gameTimeId 3, got %+v ok=%v", got, ok)
	}
	if _, ok := s.Get("s1", "players"); !ok {
		t.Fatal("want players kept alongside circuits")
	}

	s.Clear("s1")
	if _, ok := s.Get("s1", "circuits"); ok {
		t.Fatal("expected cleared store")
	}
}
