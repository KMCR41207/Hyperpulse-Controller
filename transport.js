/* ==========================================================================
   HYPERPULSE // TRANSPORT LAYER (transport.js)
   Honest capability map — clearly separates what works in-browser NOW
   vs what requires a native mobile companion app / PC client.
   ========================================================================== */

const HPTransport = (function () {

  /* ── Capability Detection ─────────────────────────────────── */
  const CAPS = {
    webUSB:        !!navigator.usb,
    webBluetooth:  !!navigator.bluetooth,
    broadcastCh:   typeof BroadcastChannel !== 'undefined',
    webSocket:     typeof WebSocket !== 'undefined',
    gamepadAPI:    !!navigator.getGamepads,
    motionSensors: typeof DeviceOrientationEvent !== 'undefined',
    vibration:     !!navigator.vibrate,
    webRTC:        typeof RTCPeerConnection !== 'undefined'
  };

  /* ── Transport status ─────────────────────────────────────── */
  // 'idle' | 'connecting' | 'connected' | 'error' | 'unsupported'
  let _status = 'idle';
  let _mode   = null;   // 'usb' | 'wifi' | 'local' | 'bluetooth'
  let _latency = 0;
  let _listeners = {};

  function emit(event, data) {
    (_listeners[event] || []).forEach(fn => fn(data));
  }

  /* ── BroadcastChannel (local dual-window) ─────────────────── */
  // WORKS IN-BROWSER: both windows must be on the same origin
  let _bc = null;

  function initBroadcastChannel() {
    if (!CAPS.broadcastCh) return false;
    _bc = new BroadcastChannel('hyperpulse_channel');
    _bc.onmessage = (e) => {
      if (e.data && e.data.type === 'INPUT_UPDATE') {
        emit('input', e.data.inputs);
        emit('latency', e.data.timestamp ? performance.now() - e.data.timestamp : 0);
      }
      if (e.data && e.data.type === 'SESSION_JOIN') {
        emit('player_join', e.data);
      }
    };
    return true;
  }

  function broadcastInputs(inputs) {
    if (_bc) {
      _bc.postMessage({ type: 'INPUT_UPDATE', inputs, timestamp: performance.now() });
    }
  }

  /* ── WebUSB ───────────────────────────────────────────────── */
  // WORKS IN-BROWSER but requires phone-side native USB app.
  // The WebUSB API lets this page REQUEST a USB device.
  // Actual HID data transfer requires matching firmware on the device.
  //
  // STATUS: UI/pairing side works. Full HID bridge needs companion app.

  async function requestUSBDevice() {
    if (!CAPS.webUSB) {
      return { success: false, reason: 'WebUSB not supported in this browser.' };
    }
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      return { success: true, device };
    } catch (err) {
      if (err.name === 'NotFoundError') {
        // User dismissed the picker — treat as soft cancel
        return { success: false, reason: 'No device selected.' };
      }
      return { success: false, reason: err.message };
    }
  }

  /* ── WebSocket (placeholder) ──────────────────────────────── */
  // REQUIRES: a WebSocket server (Node.js ws / Socket.IO) running on the PC.
  // The mobile companion app connects to the same server and relays inputs.
  //
  // STATUS: Stub only. Replace wsUrl with actual server endpoint.

  let _ws = null;

  function connectWebSocket(wsUrl) {
    if (!CAPS.webSocket) {
      return Promise.reject(new Error('WebSocket not supported'));
    }
    return new Promise((resolve, reject) => {
      try {
        _ws = new WebSocket(wsUrl);
        _ws.onopen    = () => { _status = 'connected'; emit('connect', { mode: 'websocket' }); resolve(); };
        _ws.onclose   = () => { _status = 'idle';      emit('disconnect', {}); };
        _ws.onerror   = (e) => { _status = 'error';    emit('error', e); reject(e); };
        _ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'INPUT_UPDATE') emit('input', msg.inputs);
            if (msg.type === 'LATENCY')      emit('latency', msg.ms);
          } catch (_) {}
        };
      } catch (err) { reject(err); }
    });
  }

  function sendWebSocket(msg) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify(msg));
    }
  }

  /* ── WebBluetooth ─────────────────────────────────────────── */
  // REQUIRES: GATT-compatible peripheral running on the phone.
  // STATUS: Capability detected, device request wired. Full GATT profile
  //         implementation requires companion app with BLE HID service.

  async function requestBluetoothDevice() {
    if (!CAPS.webBluetooth) {
      return { success: false, reason: 'Web Bluetooth not supported.' };
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['battery_service']
      });
      return { success: true, device };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  /* ── Gamepad API (real, works now) ───────────────────────── */
  // WORKS IN-BROWSER: any physical USB/Bluetooth gamepad connected to PC.
  // Reads standard gamepad axes and buttons at polling rate.
  let _gamepadPollId = null;

  function startGamepadPolling(onInput) {
    if (!CAPS.gamepadAPI) return false;
    function poll() {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (const gp of gamepads) {
        if (!gp) continue;
        const inputs = {
          buttons: {},
          sticks: { LX: 0, LY: 0, RX: 0, RY: 0 },
          triggers: { L2: 0, R2: 0 }
        };
        const btnNames = ['A','B','X','Y','L1','R1','L2','R2','SELECT','START',
                          'L3','R3','DPAD_UP','DPAD_DOWN','DPAD_LEFT','DPAD_RIGHT'];
        gp.buttons.forEach((btn, i) => {
          if (btnNames[i]) inputs.buttons[btnNames[i]] = btn.pressed;
          if (i === 6) inputs.triggers.L2 = btn.value;
          if (i === 7) inputs.triggers.R2 = btn.value;
        });
        if (gp.axes.length >= 4) {
          inputs.sticks.LX = parseFloat(gp.axes[0].toFixed(2));
          inputs.sticks.LY = parseFloat(gp.axes[1].toFixed(2));
          inputs.sticks.RX = parseFloat(gp.axes[2].toFixed(2));
          inputs.sticks.RY = parseFloat(gp.axes[3].toFixed(2));
        }
        onInput(inputs, gp.id);
      }
      _gamepadPollId = requestAnimationFrame(poll);
    }
    _gamepadPollId = requestAnimationFrame(poll);
    return true;
  }

  function stopGamepadPolling() {
    if (_gamepadPollId) { cancelAnimationFrame(_gamepadPollId); _gamepadPollId = null; }
  }

  /* ── Latency simulator (for prototype telemetry display) ──── */
  // Simulates realistic latency for in-browser demo mode.
  // NOT used when a real transport is active.
  let _latencySimId = null;

  function startLatencySimulator(onLatency) {
    let base = 0.4;
    _latencySimId = setInterval(() => {
      // small gaussian noise
      const jitter = (Math.random() - 0.5) * 0.2;
      base = Math.max(0.2, Math.min(2.5, base + jitter));
      _latency = parseFloat(base.toFixed(2));
      onLatency(_latency);
    }, 800);
  }

  function stopLatencySimulator() {
    if (_latencySimId) { clearInterval(_latencySimId); _latencySimId = null; }
  }

  /* ── Public API ──────────────────────────────────────────── */
  return {
    CAPS,

    on(event, fn) {
      if (!_listeners[event]) _listeners[event] = [];
      _listeners[event].push(fn);
    },

    off(event, fn) {
      if (!_listeners[event]) return;
      _listeners[event] = _listeners[event].filter(f => f !== fn);
    },

    getStatus() { return _status; },
    getMode()   { return _mode; },
    getLatency(){ return _latency; },

    /* Initialize for local dual-window mode */
    initLocal() {
      _mode = 'local';
      initBroadcastChannel();
      _status = 'connected';
      return { success: true, mode: 'local', note: 'BroadcastChannel active — works in-browser.' };
    },

    /* Broadcast inputs over active transport */
    send(inputs) {
      broadcastInputs(inputs);
      if (_ws) sendWebSocket({ type: 'INPUT_UPDATE', inputs });
    },

    /* USB pairing */
    async pairUSB() {
      _mode = 'usb';
      _status = 'connecting';
      const result = await requestUSBDevice();
      _status = result.success ? 'connected' : 'error';
      if (result.success) emit('connect', { mode: 'usb', device: result.device });
      return result;
    },

    /* Bluetooth pairing */
    async pairBluetooth() {
      _mode = 'bluetooth';
      _status = 'connecting';
      const result = await requestBluetoothDevice();
      _status = result.success ? 'connected' : 'error';
      return result;
    },

    /* WebSocket connection */
    connectWS(url) {
      _mode = 'wifi';
      return connectWebSocket(url);
    },

    /* Gamepad API */
    startGamepadPolling,
    stopGamepadPolling,

    /* Latency simulator */
    startLatencySimulator,
    stopLatencySimulator,

    /* Capability report (for status UI) */
    getCapabilityReport() {
      return [
        {
          name: 'Local Dual-Window (BroadcastChannel)',
          available: CAPS.broadcastCh,
          status: 'WORKS NOW',
          note: 'Open site in two tabs. One acts as host, one as controller.'
        },
        {
          name: 'USB Tethering (WebUSB)',
          available: CAPS.webUSB,
          status: CAPS.webUSB ? 'PARTIAL — needs companion app' : 'UNAVAILABLE',
          note: 'Device selection works. HID data relay requires phone-side native app.'
        },
        {
          name: 'Wi-Fi (WebSocket)',
          available: CAPS.webSocket,
          status: 'NEEDS SERVER',
          note: 'Requires a WebSocket relay server on the PC (Node.js ws / Socket.IO).'
        },
        {
          name: 'Bluetooth (Web Bluetooth)',
          available: CAPS.webBluetooth,
          status: CAPS.webBluetooth ? 'PARTIAL — needs GATT app' : 'UNAVAILABLE',
          note: 'Device discovery works. Full HID needs BLE GATT companion on phone.'
        },
        {
          name: 'Physical Gamepad (Gamepad API)',
          available: CAPS.gamepadAPI,
          status: 'WORKS NOW',
          note: 'Reads any USB/Bluetooth gamepad connected directly to this PC.'
        },
        {
          name: 'Motion Sensors (DeviceOrientation)',
          available: CAPS.motionSensors,
          status: 'WORKS ON MOBILE',
          note: 'Open this page on a phone browser. Gyro/accelerometer stream directly.'
        }
      ];
    }
  };
})();

window.HPTransport = HPTransport;
