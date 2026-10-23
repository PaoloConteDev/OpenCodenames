package org.opencodenames.link

import org.junit.Test
import org.junit.Assert.*

class DiscoveryQueueTest {
  @Test fun waitsForInquiryThenChecksPhonesFirstWithoutDuplicates() {
    val q = DiscoveryQueue(); q.begin(0)
    q.add("headset", 2); q.add("phone", 0); q.add("phone", 2); q.add("computer", 1)
    assertNull(q.tick(10000))
    assertEquals("phone", q.inquiryFinished(12000))
    assertNull(q.completed("headset", 12001)) // unrelated broadcast must not advance the current lookup
    assertEquals("computer", q.completed("phone", 12002))
    assertEquals("headset", q.completed("computer", 12003))
    assertNull(q.completed("headset", 12004))
    assertEquals(DiscoveryQueue.Phase.IDLE, q.phase)
  }
  @Test fun missingRepliesTimeOutAndOverallBudgetIsBounded() {
    val q = DiscoveryQueue(); q.begin(0)
    repeat(20) { q.add("phone$it", 0) }
    assertEquals("phone0", q.inquiryFinished(1000))
    assertNull(q.tick(5999))
    assertEquals("phone1", q.tick(6000))
    assertNull(q.completed("phone0", 6001)) // late reply from previous lookup
    assertEquals("phone2", q.tick(11000))
    assertEquals("phone3", q.tick(16000))
    assertNull(q.tick(21000))
    assertEquals(DiscoveryQueue.Phase.IDLE, q.phase)
  }
  @Test fun inquiryHasWatchdogWhenAndroidOmitsFinishedBroadcast() {
    val q = DiscoveryQueue(); q.begin(100)
    q.add("phone", 0)
    assertNull(q.tick(25099))
    assertEquals("phone", q.tick(25100))
    assertEquals(DiscoveryQueue.Phase.SERVICES, q.phase)
  }
  @Test fun cancellationAndRestartDiscardOldWork() {
    val q = DiscoveryQueue(); q.begin(0); q.add("old", 0)
    assertEquals("old", q.inquiryFinished(10))
    q.cancel()
    assertNull(q.tick(100000)); assertNull(q.completed("old", 100000))
    q.begin(100001); q.add("new", 0)
    assertEquals("new", q.inquiryFinished(100002))
    assertNull(q.completed("old", 100003))
    assertNull(q.completed("new", 100004))
    assertEquals(DiscoveryQueue.Phase.IDLE, q.phase)
  }
  @Test fun emptyInquiryFinishesAndCandidateCountIsBounded() {
    val q = DiscoveryQueue(); q.begin(0)
    assertNull(q.inquiryFinished(1)); assertEquals(DiscoveryQueue.Phase.IDLE, q.phase)
    q.begin(2); repeat(100) { q.add("device$it", 0) }
    var address = q.inquiryFinished(3); var count = 0
    while (address != null) { count++; address = q.completed(address, 4) }
    assertEquals(64, count)
  }
}
