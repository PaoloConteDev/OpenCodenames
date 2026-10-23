@file:Suppress("MissingPermission", "DEPRECATION")
package org.opencodenames.link

import android.bluetooth.*
import android.content.*
import android.os.Build
import android.os.ParcelUuid
import android.util.AtomicFile
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.*
import java.net.*
import java.security.SecureRandom
import java.util.UUID
import java.util.concurrent.*
import java.util.concurrent.atomic.AtomicBoolean

/** Real Android sockets only. Bluetooth has no dependency on IP, Wi-Fi or Play Services. */
class OfflineLinkModule : Module() {
  private val rng = SecureRandom()
  private val pool = Executors.newCachedThreadPool()
  private val timers = Executors.newSingleThreadScheduledExecutor()
  private val peers = ConcurrentHashMap<String, Peer>()
  private val listeners = CopyOnWriteArrayList<Closeable>()
  private val connecting = CopyOnWriteArrayList<Closeable>()
  private val generation = java.util.concurrent.atomic.AtomicInteger(0)
  private val slots = ConcurrentHashMap<Int, Closeable>()
  private var receiver: BroadcastReceiver? = null
  private val uuids = (0 until BuildConfig.MAX_REMOTE_BLUETOOTH).map { UUID.fromString("f378dc0${it}-42ba-4ec4-a16a-70656e636f64") }
  private val relayUuids = (0 until BuildConfig.MAX_RELAY_CHILDREN).map { UUID.fromString("f378dc1${it}-42ba-4ec4-a16a-70656e636f64") }
  private val relayListeners = CopyOnWriteArrayList<Closeable>()
  private val searchLock = Any()
  private val search = DiscoveryQueue()
  private val discovered = mutableMapOf<String, BluetoothDevice>()
  private var searchTimer: ScheduledFuture<*>? = null
  private var inquiryStarted = false
  private var searchFinished = true
  private var servicesAnnounced = false
  private val context get() = requireNotNull(appContext.reactContext)
  private val adapter get() = (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
  private fun bt(): BluetoothAdapter = requireNotNull(adapter) { "Bluetooth Classic non disponibile" }.also {
    check(it.isEnabled) { "Attiva il Bluetooth nelle impostazioni e riprova" }
  }
  private fun event(type: String, vararg fields: Pair<String, Any?>) = sendEvent("link", mapOf("type" to type, *fields))
  private data class Peer(val id: String, val input: InputStream, val output: OutputStream, val socket: Closeable,
    val closed: AtomicBoolean = AtomicBoolean(false), var window: Long = System.currentTimeMillis(), var count: Int = 0,
    val slot: Int? = null, val client: Boolean = false)

  override fun definition() = ModuleDefinition {
    Name("OfflineLink")
    Events("link")
    Function("token") { ByteArray(32).also(rng::nextBytes).joinToString("") { "%02x".format(it) } }
    Function("randomInt") { bound: Int -> require(bound > 0); rng.nextInt(bound) }
    Function("systemLanguage") { java.util.Locale.getDefault().toLanguageTag() }
    Function("feedback") { sound: Boolean ->
      if (sound) android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 40).let { tone ->
        tone.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, 90)
        timers.schedule({ tone.release() }, 150, TimeUnit.MILLISECONDS)
      }
    }
    Function("revealFeedback") { kind: String, sound: Boolean ->
      if (sound) {
        val toneType = when (kind) {
          "correct" -> android.media.ToneGenerator.TONE_PROP_ACK
          "opponent" -> android.media.ToneGenerator.TONE_PROP_NACK
          "assassin" -> android.media.ToneGenerator.TONE_SUP_ERROR
          else -> android.media.ToneGenerator.TONE_PROP_BEEP
        }
        val duration = if (kind == "assassin") 320 else 170
        // Feedback must never interrupt a committed game action on audio failure.
        try {
          val tone = android.media.ToneGenerator(android.media.AudioManager.STREAM_MUSIC, 45)
          try {
            tone.startTone(toneType, duration)
            timers.schedule({ tone.release() }, (duration + 100).toLong(), TimeUnit.MILLISECONDS)
          } catch (_: RuntimeException) { tone.release() }
        } catch (_: RuntimeException) { }
      }
    }
    AsyncFunction("readStore") { key: String ->
      require(key in listOf("host", "client", "settings"))
      val file = AtomicFile(File(context.filesDir, "oc-$key.json"))
      try { file.openRead().bufferedReader().use { it.readText() } } catch (_: FileNotFoundException) { null }
    }
    AsyncFunction("writeStore") { key: String, value: String ->
      require(key in listOf("host", "client", "settings")); require(value.toByteArray().size <= 2097152)
      val file = AtomicFile(File(context.filesDir, "oc-$key.json"))
      val stream = file.startWrite()
      try { stream.write(value.toByteArray()); file.finishWrite(stream) }
      catch (e: Exception) { file.failWrite(stream); throw e }
    }
    AsyncFunction("discoverable") {
      bt()
      val activity = requireNotNull(appContext.currentActivity)
      activity.runOnUiThread {
        activity.startActivity(Intent(BluetoothAdapter.ACTION_REQUEST_DISCOVERABLE)
          .putExtra(BluetoothAdapter.EXTRA_DISCOVERABLE_DURATION, 300))
      }
    }
    AsyncFunction("discover") {
      val bluetooth = bt()
      registerReceiver()
      synchronized(searchLock) {
        stopSearch()
        search.begin(android.os.SystemClock.elapsedRealtime())
        searchFinished = false; inquiryStarted = false; servicesAnnounced = false
        try {
          // Paired hosts remain selectable even when inquiry / SDP does not rediscover them.
          bluetooth.bondedDevices.forEach(::rememberDevice)
          check(bluetooth.startDiscovery()) { "Ricerca non avviata. Su Android 11 o precedente attiva anche la posizione." }
          searchTimer = timers.scheduleAtFixedRate({
            synchronized(searchLock) {
              if (!searchFinished) {
                val wasInquiry = search.phase == DiscoveryQueue.Phase.INQUIRY
                val next = search.tick(android.os.SystemClock.elapsedRealtime())
                if (wasInquiry && search.phase != DiscoveryQueue.Phase.INQUIRY) runCatching { adapter?.cancelDiscovery() }
                searchProgress(next)
              }
            }
          }, 1, 1, TimeUnit.SECONDS)
        } catch (e: Exception) { stopSearch(); throw e }
      }
    }
    AsyncFunction("stopDiscovery") { synchronized(searchLock) { stopSearch() }; event("discoveryFinished") }
    AsyncFunction("startHost") { mode: String ->
      stop()
      val epoch = generation.get()
      if (mode == "bluetooth") {
        val bluetooth = bt()
        registerReceiver()
        try {
          openBluetoothListeners(uuids, epoch, false)
        } catch (e: Exception) { stop(); throw IllegalStateException("Impossibile aprire i canali RFCOMM: ${e.javaClass.simpleName}") }
        mapOf("name" to bluetooth.name, "addresses" to emptyList<String>(), "port" to 0)
      } else {
        require(mode == "lan")
        val server = ServerSocket().apply { reuseAddress = true; bind(InetSocketAddress(42831)) }
        listeners.add(server)
        pool.execute {
          while (generation.get() == epoch) {
            try {
              val socket = server.accept()
              if (generation.get() != epoch || peers.size >= BuildConfig.MAX_REMOTE_LAN ||
                !(socket.inetAddress.isSiteLocalAddress || socket.inetAddress.isLoopbackAddress)) socket.close()
              else { socket.tcpNoDelay = true; attach(socket.getInputStream(), socket.getOutputStream(), socket, false) }
            } catch (_: Exception) { break }
          }
        }
        val addresses = NetworkInterface.getNetworkInterfaces().toList().flatMap { it.inetAddresses.toList() }
          .filter { it is Inet4Address && it.isSiteLocalAddress && !it.isLoopbackAddress }.map { it.hostAddress }
        mapOf("name" to Build.MODEL, "addresses" to addresses, "port" to 42831)
      }
    }
    AsyncFunction("startRelay") {
      check(peers.values.any { it.client }) { "Prima collegati direttamente all’host" }
      check(relayListeners.isEmpty()) { "Ponte già attivo" }
      bt(); registerReceiver()
      try { openBluetoothListeners(relayUuids, generation.get(), true) }
      catch (e: Exception) { stopRelay(); throw IllegalStateException("Ponte non supportato dal telefono: ${e.javaClass.simpleName}") }
    }
    AsyncFunction("stopRelay") { stopRelay() }
    AsyncFunction("connect") { mode: String, address: String, port: Int, viaRelay: Boolean ->
      val epoch = generation.get()
      if (mode == "bluetooth") {
        val bluetooth = bt(); synchronized(searchLock) { stopSearch() }
        val device = bluetooth.getRemoteDevice(address)
        var result: String? = null
        for (uuid in if (viaRelay) relayUuids else uuids) {
          check(epoch == generation.get()) { "Connessione annullata" }
          val socket = device.createRfcommSocketToServiceRecord(uuid)
          connecting.add(socket)
          val deadline = timers.schedule({ runCatching { socket.close() } }, 7, TimeUnit.SECONDS)
          try {
            socket.connect()
            check(socket.inputStream.read() == 0x4f) { "Canale occupato" }
            deadline.cancel(false)
            check(epoch == generation.get())
            result = attach(socket.inputStream, socket.outputStream, socket, true)
            break
          } catch (_: Exception) { runCatching { socket.close() } }
          finally { deadline.cancel(false); connecting.remove(socket) }
        }
        requireNotNull(result) { "Host non raggiungibile o stanza piena. Verifica associazione e visibilità Bluetooth." }
      } else {
        require(mode == "lan" && port == 42831)
        require(address.matches(Regex("[0-9]{1,3}(\\.[0-9]{1,3}){3}"))) { "Inserisci un IPv4 locale" }
        val ip = InetAddress.getByName(address)
        require(ip is Inet4Address && ip.isSiteLocalAddress && !ip.isLoopbackAddress) { "Sono ammessi solo indirizzi di rete privata" }
        val socket = Socket(); connecting.add(socket)
        try {
          socket.connect(InetSocketAddress(ip, port), 8000); socket.tcpNoDelay = true
          check(epoch == generation.get())
          attach(socket.getInputStream(), socket.getOutputStream(), socket, true)
        } catch (e: Exception) { socket.close(); throw e }
        finally { connecting.remove(socket) }
      }
    }
    AsyncFunction("send") { id: String, text: String ->
      val peer = requireNotNull(peers[id]) { "Connessione persa" }
      // Closing a stalled socket unblocks both Bluetooth and TCP writers.
      val timeout = timers.schedule({ closePeer(id) }, 4, TimeUnit.SECONDS)
      try { synchronized(peer.output) { FrameCodec.write(peer.output, text) } }
      catch (e: Exception) { closePeer(id); throw e }
      finally { timeout.cancel(false) }
    }
    AsyncFunction("close") { id: String -> closePeer(id) }
    AsyncFunction("stop") { stop() }
    OnDestroy { stop(); receiver?.let { runCatching { context.unregisterReceiver(it) } }; receiver = null; pool.shutdownNow(); timers.shutdownNow() }
  }

  private fun attach(input: InputStream, output: OutputStream, socket: Closeable, client: Boolean, slot: Int? = null): String {
    val id = UUID.randomUUID().toString()
    val peer = Peer(id, input, output, socket, slot = slot, client = client)
    peers[id] = peer
    event("connected", "peer" to id, "client" to client)
    pool.execute {
      try {
        while (!peer.closed.get()) {
          val text = FrameCodec.read(input)
          val now = System.currentTimeMillis()
          if (now - peer.window >= 1000) { peer.window = now; peer.count = 0 }
          // A direct peer can aggregate its own traffic plus two encrypted relay streams.
          check(++peer.count <= 60) { "Troppi messaggi" }
          event("message", "peer" to id, "text" to text)
        }
      } catch (_: Exception) { /* Never emit message contents or session credentials. */ }
      finally { closePeer(id) }
    }
    return id
  }
  private fun closePeer(id: String) {
    val peer = peers.remove(id) ?: return
    if (peer.closed.compareAndSet(false, true)) {
      runCatching { peer.socket.close() }
      peer.slot?.let { slots.remove(it, peer.socket) }
      event("disconnected", "peer" to id)
    }
  }
  private fun openBluetoothListeners(services: List<UUID>, epoch: Int, relay: Boolean) {
    val limit = if (relay) BuildConfig.MAX_RELAY_CHILDREN else BuildConfig.MAX_REMOTE_BLUETOOTH
    services.forEachIndexed { index, uuid ->
      val slot = index + if (relay) 100 else 0
      val server = bt().listenUsingRfcommWithServiceRecord("Open Codenames ${if (relay) "Ponte" else "Host"} ${index + 1}", uuid)
      (if (relay) relayListeners else listeners).add(server)
      pool.execute {
        while (generation.get() == epoch) {
          try {
            val socket = server.accept()
            // Atomic slot reservation also bounds simultaneous accept threads.
            if (epoch != generation.get() || peers.values.count { !it.client } >= limit || slots.putIfAbsent(slot, socket) != null) {
              runCatching { socket.outputStream.write(0); socket.outputStream.flush() }; socket.close()
            } else try {
              socket.outputStream.write(0x4f); socket.outputStream.flush()
              attach(socket.inputStream, socket.outputStream, socket, false, slot)
            } catch (_: Exception) { slots.remove(slot, socket); socket.close() }
          } catch (_: Exception) { break }
        }
      }
    }
  }
  private fun stopRelay() {
    relayListeners.forEach { runCatching { it.close() } }; relayListeners.clear()
    peers.values.filter { !it.client && (it.slot ?: -1) >= 100 }.map { it.id }.forEach(::closePeer)
  }
  private fun stop() {
    generation.incrementAndGet()
    stopRelay()
    listeners.forEach { runCatching { it.close() } }; listeners.clear()
    connecting.forEach { runCatching { it.close() } }; connecting.clear()
    peers.keys.toList().forEach(::closePeer)
    slots.values.forEach { runCatching { it.close() } }; slots.clear()
    synchronized(searchLock) { stopSearch() }
  }
  private fun stopSearch() {
    searchTimer?.cancel(false); searchTimer = null
    search.cancel(); discovered.clear(); searchFinished = true; inquiryStarted = false
    runCatching { adapter?.cancelDiscovery() }
  }
  private fun name(device: BluetoothDevice) = device.name?.takeIf { it.isNotBlank() } ?: "Dispositivo Bluetooth"
  private fun rememberDevice(device: BluetoothDevice) {
    if (device.type == BluetoothDevice.DEVICE_TYPE_LE) return // RFCOMM needs Classic / dual-mode.
    if (discovered.size >= 64 && device.address !in discovered) return
    discovered[device.address] = device
    val priority = when (device.bluetoothClass?.majorDeviceClass) {
      BluetoothClass.Device.Major.PHONE -> 0
      BluetoothClass.Device.Major.COMPUTER -> 1
      else -> 2
    }
    search.add(device.address, priority)
    event("device", "name" to name(device), "address" to device.address, "paired" to (device.bondState == BluetoothDevice.BOND_BONDED))
    publishServices(device, device.uuids?.map { it.uuid } ?: emptyList())
  }
  private fun publishServices(device: BluetoothDevice, services: List<UUID>) {
    for (relay in listOf(false, true)) if (services.any { it in (if (relay) relayUuids else uuids) })
      event("host", "name" to name(device), "address" to device.address, "relay" to relay,
        "paired" to (device.bondState == BluetoothDevice.BOND_BONDED))
  }
  private fun searchProgress(address: String?) {
    if (search.phase == DiscoveryQueue.Phase.SERVICES && !servicesAnnounced) {
      servicesAnnounced = true; event("discoveryStage", "stage" to "services")
    }
    var next = address
    while (next != null) {
      val current = next
      val started = runCatching { discovered[current]?.fetchUuidsWithSdp() == true }.getOrDefault(false)
      if (started) break
      next = search.completed(current, android.os.SystemClock.elapsedRealtime())
    }
    if (search.phase == DiscoveryQueue.Phase.IDLE && !searchFinished) {
      searchFinished = true; searchTimer?.cancel(false); searchTimer = null
      // Keep candidates so late / cached UUID results can still improve their labels.
      event("discoveryFinished")
    }
  }
  private fun registerReceiver() {
    if (receiver != null) return
    receiver = object : BroadcastReceiver() {
      override fun onReceive(ctx: Context, intent: Intent) {
        val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
        when (intent.action) {
          BluetoothDevice.ACTION_FOUND -> synchronized(searchLock) {
            if (device != null && search.phase == DiscoveryQueue.Phase.INQUIRY) rememberDevice(device)
          }
          BluetoothDevice.ACTION_UUID -> {
            val services = intent.getParcelableArrayExtra(BluetoothDevice.EXTRA_UUID)?.filterIsInstance<ParcelUuid>() ?: emptyList()
            synchronized(searchLock) {
              if (device != null && device.address in discovered) {
                publishServices(device, services.map { it.uuid })
                searchProgress(search.completed(device.address, android.os.SystemClock.elapsedRealtime()))
              }
            }
          }
          BluetoothAdapter.ACTION_DISCOVERY_STARTED -> synchronized(searchLock) {
            if (search.phase == DiscoveryQueue.Phase.INQUIRY) inquiryStarted = true
          }
          BluetoothAdapter.ACTION_DISCOVERY_FINISHED -> synchronized(searchLock) {
            // Ignore the old cancellation broadcast when the user has restarted a scan.
            if (search.phase == DiscoveryQueue.Phase.INQUIRY && inquiryStarted && adapter?.isDiscovering != true)
              searchProgress(search.inquiryFinished(android.os.SystemClock.elapsedRealtime()))
          }
          BluetoothAdapter.ACTION_STATE_CHANGED -> if (intent.getIntExtra(BluetoothAdapter.EXTRA_STATE, -1) == BluetoothAdapter.STATE_OFF) {
            stop(); event("error", "message" to "Bluetooth disattivato. Riattivalo e riprendi la connessione.")
          }
        }
      }
    }
    val filter = IntentFilter().apply {
      addAction(BluetoothDevice.ACTION_FOUND); addAction(BluetoothDevice.ACTION_UUID)
      addAction(BluetoothAdapter.ACTION_DISCOVERY_STARTED); addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED); addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
    }
    if (Build.VERSION.SDK_INT >= 33) context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
    else context.registerReceiver(receiver, filter)
  }
}
