let record_button = document.getElementById('record');
let baseline_input = document.getElementById('baseline');
let canvas = document.getElementById('chart');
let history = [];
let last_state = null;
let pending_command = null;
let load_window = [];
let load_window_start = null;

function renderLoadStats(state, ready)
{
    let previous = load_window.length ? load_window[load_window.length - 1] : null;
    let reset_window = !ready;
    if (ready && previous != null)
    {
        let run_changed = previous.run_id != state.run_id;
        let sample_delta = state.sample_time - previous.time;
        let time_gap = sample_delta > 0.5 || sample_delta < 0;
        reset_window = run_changed || time_gap;
    }
    if (reset_window)
    {
        load_window = [];
        load_window_start = null;
        previous = null;
    }
    if (ready && (previous == null || previous.time != state.sample_time))
    {
        if (load_window_start == null)
        {
            load_window_start = state.sample_time;
        }
        let sample =
        {
            time: state.sample_time,
            total_kg: state.total_kg,
            run_id: state.run_id
        };
        load_window.push(sample);
        let window_cutoff = state.sample_time - 2;
        while (load_window.length && load_window[0].time <= window_cutoff)
        {
            load_window.shift();
        }
    }

    let average_text = '—';
    let stdev_text = '—';
    let note = ready ? 'Collecting 2 s…' : 'Waiting for readings';
    if (ready && state.sample_time - load_window_start >= 2)
    {
        let mean = 0;
        let squared_deviations = 0;
        let count = 0;
        for (let point of load_window)
        {
            ++count;
            let delta = point.total_kg - mean;
            mean += delta/count;
            squared_deviations += delta*(point.total_kg - mean);
        }
        let variance = Math.max(0, squared_deviations/count);
        let stdev = Math.sqrt(variance);
        average_text = mean.toFixed(2);
        stdev_text = stdev.toFixed(2);
        note = 'Last 2 s of live readings';
    }
    document.getElementById('load-average').textContent = average_text;
    document.getElementById('load-stdev').textContent = stdev_text;
    document.getElementById('load-window-note').textContent = note;
}

function showError(message)
{
    let element = document.getElementById('error');
    element.textContent = message;
    element.hidden = !message;
}

function formatDuration(seconds)
{
    let minutes = Math.floor(seconds/60);
    let remaining_seconds = Math.floor(seconds%60);
    let minutes_text = String(minutes).padStart(2, '0');
    let seconds_text = String(remaining_seconds).padStart(2, '0');
    return minutes_text + ':' + seconds_text;
}

function renderState(state)
{
    last_state = state;
    let live = state.live && state.connected;
    let ready = live && !state.taring && state.total_kg != null;
    let connection = document.getElementById('connection');
    connection.classList.toggle('connected', live);
    connection.textContent = live ? 'Board connected' : 'Board offline';
    document.getElementById('total').textContent = ready ? state.total_kg.toFixed(2) : '—';
    for (let i = 0; i < 4; ++i)
    {
        let value = '—';
        if (live && state.corners_kg != null)
        {
            value = state.corners_kg[i].toFixed(3);
        }
        document.getElementById('corner-' + (i + 1)).textContent = value;
    }

    if (pending_command != null && pending_command.command_id != null)
    {
        if (state.live && state.run_id != pending_command.run_id)
        {
            pending_command = null;
            showError('The logger restarted. Recording is stopped; press Record to start again.');
        }
        else if (state.live && state.applied_command == pending_command.command_id)
        {
            pending_command = null;
            showError(state.command_error);
        }
        else if (Date.now() - pending_command.sent_at > 5000)
        {
            pending_command = null;
            showError('Recording command was not confirmed. Check the current status before retrying.');
        }
    }
    let recording = state.live && state.recording;
    record_button.classList.toggle('recording', Boolean(recording));
    record_button.disabled = pending_command != null || !state.live || (!ready && !recording);
    let record_label = recording ? 'Stop' : 'Record';
    if (pending_command != null)
    {
        record_label = 'Waiting…';
    }
    document.getElementById('record-label').textContent = record_label;
    let recording_text = 'Preview · not saving';
    if (!state.live)
    {
        recording_text = 'Recording status unavailable';
    }
    if (recording)
    {
        let elapsed_seconds = Math.max(0, Date.now()/1000 - state.recording_started_at);
        recording_text = 'Recording · ' + formatDuration(elapsed_seconds);
    }
    document.getElementById('record-state').textContent = recording_text;
    let rows_written = state.rows_written || 0;
    document.getElementById('rows').textContent = rows_written.toLocaleString() + ' samples recorded';
    let message = 'Live preview. CSV writing starts only when you press Record.';
    if (!state.live)
    {
        message = 'Logger unavailable. Check the Pi services; recording status cannot be confirmed.';
    }
    if (state.live && !state.connected)
    {
        message = 'Press the board’s front button to connect. Recording is stopped.';
    }
    if (live && state.taring)
    {
        message = 'Taring… Leave the board empty for two seconds. Recording is stopped.';
    }
    if (recording)
    {
        message = 'Saving readings to the CSV on the Pi. Press Stop to finish.';
    }
    document.getElementById('message').textContent = message;

    if (ready)
    {
        if (history.length && history[history.length - 1].run_id != state.run_id)
        {
            history = [];
        }
        if (!history.length || history[history.length - 1].time != state.sample_time)
        {
            let sample =
            {
                time: state.sample_time,
                total_kg: state.total_kg,
                run_id: state.run_id
            };
            history.push(sample);
        }
    }
    renderLoadStats(state, ready);
    drawChart();
}

function showOffline()
{
    let state =
    {
        live: false,
        connected: false,
        recording: false
    };
    renderState(state);
}

function pollStatus()
{
    let request = new XMLHttpRequest();
    request.open('GET', '/api/status');
    request.timeout = 1500;
    request.onload = function ()
    {
        if (request.status != 200)
        {
            showOffline();
            return;
        }
        renderState(JSON.parse(request.responseText));
    };
    request.onerror = showOffline;
    request.ontimeout = showOffline;
    request.onloadend = function ()
    {
        window.setTimeout(pollStatus, 100);
    };
    request.send();
}

function recordingFailed(message)
{
    pending_command = null;
    showError(message);
    if (last_state != null)
    {
        renderState(last_state);
    }
}

function controlRecording()
{
    if (last_state == null || !last_state.live || pending_command != null)
    {
        return;
    }
    let action = last_state.recording ? 'stop' : 'start';
    pending_command =
    {
        command_id: null,
        run_id: last_state.run_id,
        sent_at: Date.now()
    };
    showError('');
    renderState(last_state);
    let request = new XMLHttpRequest();
    request.open('POST', '/api/record/' + action);
    request.setRequestHeader('X-Wii-Control', 'dashboard');
    request.timeout = 2000;
    request.onload = function ()
    {
        let result = JSON.parse(request.responseText);
        if (request.status != 202)
        {
            recordingFailed(result.error);
            return;
        }
        pending_command =
        {
            command_id: result.command_id,
            run_id: result.run_id,
            sent_at: Date.now()
        };
    };
    request.onerror = function ()
    {
        recordingFailed('Control response unavailable. Check recording status before retrying.');
    };
    request.ontimeout = request.onerror;
    request.send();
}

function drawChart()
{
    let pixel_ratio = window.devicePixelRatio || 1;
    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    canvas.width = Math.round(width*pixel_ratio);
    canvas.height = Math.round(height*pixel_ratio);
    let context = canvas.getContext('2d');
    context.scale(pixel_ratio, pixel_ratio);
    let now = Date.now()/1000;
    while (history.length && history[0].time < now - 60)
    {
        history.shift();
    }
    let baseline = Number(baseline_input.value);
    let maximum = Math.max(20, baseline*1.15);
    for (let point of history)
    {
        maximum = Math.max(maximum, point.total_kg*1.15);
    }
    maximum = Math.ceil(maximum/10)*10;
    let left = 46;
    let top = 12;
    let plot_width = width - left - 4;
    let plot_height = height - top - 8;
    context.font = '10px system-ui';
    for (let i = 0; i <= 4; ++i)
    {
        let y = top + plot_height*i/4;
        context.strokeStyle = '#303d34';
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width, y);
        context.stroke();
        context.fillStyle = '#91a394';
        context.fillText((maximum*(1 - i/4)).toFixed(0), 0, y + 3);
    }
    if (baseline > 0)
    {
        let y = top + plot_height*(1 - baseline/maximum);
        context.strokeStyle = '#b8b2db';
        context.setLineDash([5, 5]);
        context.beginPath();
        context.moveTo(left, y);
        context.lineTo(width, y);
        context.stroke();
        context.setLineDash([]);
    }
    context.strokeStyle = '#c9f785';
    context.lineWidth = 2;
    context.lineJoin = 'round';
    context.beginPath();
    let previous_time = null;
    for (let point of history)
    {
        let time_fraction = (point.time - (now - 60))/60;
        let load_fraction = point.total_kg/maximum;
        let x = left + plot_width*time_fraction;
        let y = top + plot_height*(1 - load_fraction);
        if (previous_time == null || point.time - previous_time > 0.5)
        {
            context.moveTo(x, y);
        }
        else
        {
            context.lineTo(x, y);
        }
        previous_time = point.time;
    }
    context.stroke();
    if (!history.length)
    {
        context.fillStyle = '#91a394';
        context.textAlign = 'center';
        context.fillText('Waiting for board readings', left + plot_width/2, height/2);
    }
}

record_button.addEventListener('click', controlRecording);
baseline_input.addEventListener('input', drawChart);
window.addEventListener('resize', drawChart);
pollStatus();
