package org.opencodenames.link

/** Bounded SDP verification after inquiry. A failed lookup never removes a visible candidate. */
internal class DiscoveryQueue {
  enum class Phase { IDLE, INQUIRY, SERVICES }
  var phase = Phase.IDLE; private set
  private val candidates = linkedMapOf<String, Int>()
  private val attempted = mutableSetOf<String>()
  private var current: String? = null
  private var inquiryDeadline = 0L
  private var servicesDeadline = 0L
  private var requestDeadline = 0L

  fun begin(now: Long) {
    cancel(); phase = Phase.INQUIRY; inquiryDeadline = now + 25000
  }
  fun add(address: String, priority: Int) {
    if (phase != Phase.INQUIRY || address in attempted) return
    if (candidates.size < 64 || address in candidates)
      candidates[address] = minOf(candidates[address] ?: priority, priority)
  }
  fun inquiryFinished(now: Long): String? {
    if (phase != Phase.INQUIRY) return null
    phase = Phase.SERVICES; servicesDeadline = now + 20000
    return next(now)
  }
  fun completed(address: String, now: Long): String? {
    if (phase != Phase.SERVICES || current != address) return null
    current = null; return next(now)
  }
  fun tick(now: Long): String? {
    if (phase == Phase.INQUIRY && now >= inquiryDeadline) return inquiryFinished(now)
    if (phase == Phase.SERVICES && (now >= servicesDeadline || current == null || now >= requestDeadline)) {
      current = null; return next(now)
    }
    return null
  }
  private fun next(now: Long): String? {
    if (now >= servicesDeadline || candidates.isEmpty()) { phase = Phase.IDLE; current = null; return null }
    val address = candidates.minByOrNull { it.value }!!.key
    candidates.remove(address); attempted.add(address)
    current = address; requestDeadline = now + 5000
    return address
  }
  fun cancel() {
    phase = Phase.IDLE; candidates.clear(); attempted.clear(); current = null
  }
}
