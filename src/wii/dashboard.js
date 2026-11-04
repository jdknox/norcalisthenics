let record_button = document.getElementById('record');
let baseline_input = document.getElementById('baseline');
let canvas = document.getElementById('chart');
let corner_readout = document.getElementById('corner-readout');
let copy_corners_button = document.getElementById('copy-corners');
let history = [];
let last_state = null;
let pending_command = null;
let last_load_stats = null;
let last_sample_window = null;
let sample_age_history = [];
let WINDOW_DURATION = 3;
const CORNER_DEVIATION_LIMIT_KG = 0.3;
const EXPECTED_WINDOW_SAMPLES = 30;
const SAMPLE_DELAY_MS = 500;

function formatSampleAge(age_ms)
{
    return age_ms < 1000 ? Math.round(age_ms) + ' ms' : (age_ms/1000).toFixed(1) + ' s';
}

function refreshSampleCoverage()
{
    // Observe displayed age on the timer, so extra polling/control renders cannot bias statistics.
    if (last_sample_window != null && last_sample_window.age_ms != null)
    {
        let now = performance.now();
        let age_ms = last_sample_window.age_ms + now - last_sample_window.received_at;
        sample_age_history.push({time: now, age_ms: age_ms});
    }
    renderSampleCoverage();
}

function renderSampleAgeStats()
{
    let cutoff = performance.now() - WINDOW_DURATION*1000;
    while (sample_age_history.length && sample_age_history[0].time <= cutoff)
    {
        sample_age_history.shift();
    }
    let average_text = '—';
    let min_text = '—';
    let max_text = '—';
    if (sample_age_history.length)
    {
        let total = 0;
        let minimum = Infinity;
        let maximum = 0;
        for (let observation of sample_age_history)
        {
            total += observation.age_ms;
            minimum = Math.min(minimum, observation.age_ms);
            maximum = Math.max(maximum, observation.age_ms);
        }
        average_text = formatSampleAge(total/sample_age_history.length);
        min_text = formatSampleAge(minimum);
        max_text = formatSampleAge(maximum);
    }
    document.getElementById('sample-age-average').textContent = average_text;
    document.getElementById('sample-age-min').textContent = min_text;
    document.getElementById('sample-age-max').textContent = max_text;
}

function updateSampleCoverage(state, request_started_at)
{
    if (state.live)
    {
        if (!state.connected || state.taring || state.sample_time == null)
        {
            last_sample_window = null;
        }
        else if (state.load_samples != null)
        {
            // Re-rendering controls must not reset the age of the same sample.
            if (request_started_at != null || last_sample_window == null ||
                last_sample_window.sample_time != state.sample_time || last_sample_window.run_id != state.run_id)
            {
                let now = performance.now();
                if (last_sample_window != null && last_sample_window.run_id != state.run_id)
                {
                    sample_age_history = [];
                }
                let age_ms = state.sample_age_ms;
                if (age_ms != null && request_started_at != null)
                {
                    // Include request transit time conservatively; browser and Pi clocks may differ.
                    age_ms += now - request_started_at;
                }
                last_sample_window =
                {
                    count: state.load_samples,
                    sample_time: state.sample_time,
                    run_id: state.run_id,
                    age_ms: age_ms,
                    received_at: now,
                    collecting: state.load_average_kg == null
                };
            }
        }
        else
        {
            last_sample_window = null;
        }
    }
    if (last_sample_window == null || last_sample_window.age_ms == null)
    {
        sample_age_history = [];
    }
    renderSampleCoverage();
}

function renderSampleCoverage()
{
    let count_text = `—/${EXPECTED_WINDOW_SAMPLES} samples · —%`;
    let freshness = 'Latest sample: — · waiting for readings';
    let percent = 0;
    let delayed = false;
    if (last_sample_window != null)
    {
        percent = Math.min(100, Math.round(last_sample_window.count/EXPECTED_WINDOW_SAMPLES*100));
        count_text = `${last_sample_window.count}/${EXPECTED_WINDOW_SAMPLES} samples · ${percent}%`;
        freshness = 'Latest sample: unavailable · update the Pi dashboard';
        delayed = true;
        if (last_sample_window.age_ms != null)
        {
            let age_ms = last_sample_window.age_ms + performance.now() - last_sample_window.received_at;
            let age_text = formatSampleAge(age_ms);
            delayed = !last_state.live || age_ms > SAMPLE_DELAY_MS;
            freshness = `Latest sample: ${age_text} ago`;
            if (delayed)
            {
                freshness += ' · updates delayed · last received window';
            }
            else if (last_sample_window.collecting)
            {
                freshness += ` · collecting ${WINDOW_DURATION} s`;
            }
        }
    }
    document.getElementById('sample-count').textContent = count_text;
    document.getElementById('sample-freshness').textContent = freshness;
    let meter = document.getElementById('sample-coverage');
    meter.setAttribute('aria-valuenow', String(percent));
    meter.setAttribute('aria-valuetext', count_text + '. ' + freshness);
    document.getElementById('sample-coverage-fill').style.width = percent + '%';
    meter.parentElement.classList.toggle('delayed', delayed);
    renderSampleAgeStats();
}

function renderLoadStats(state, ready)
{
    let average_text = '—';
    let stdev_text = '—';
    let note = ready ? `Collecting ${WINDOW_DURATION} s…` : 'Waiting for readings';
    if (ready && !('load_average_kg' in state))
    {
        note = `Update the Pi logger to enable ${WINDOW_DURATION} s statistics.`;
    }
    if (state.live)
    {
        last_load_stats = null;
        if (ready && state.load_average_kg != null && state.load_stdev_kg != null)
        {
            last_load_stats =
            {
                average_kg: state.load_average_kg,
                stdev_kg: state.load_stdev_kg,
                corner_average_kg: state.corner_average_kg,
                corner_stdev_kg: state.corner_stdev_kg,
                corner_min_kg: state.corner_min_kg,
                corner_max_kg: state.corner_max_kg
            };
        }
    }
    if (last_load_stats != null)
    {
        average_text = last_load_stats.average_kg.toFixed(2);
        stdev_text = last_load_stats.stdev_kg.toFixed(2);
        note = state.live ? `Last ${WINDOW_DURATION} s of board readings`
                          : 'Updates delayed · showing last values';
    }
    document.getElementById('load-average').textContent = average_text;
    document.getElementById('load-stdev').textContent = stdev_text;
    document.getElementById('total-raw').textContent = ready ? state.total_kg.toFixed(2) : '—';
    document.getElementById('load-window-note').textContent = note;
    renderCornerStats(last_load_stats, note);
}

function renderCornerStats(stats, note)
{
    let has_stats = stats != null && stats.corner_average_kg != null && stats.corner_stdev_kg != null;
    let has_range = has_stats && stats.corner_min_kg != null && stats.corner_max_kg != null;
    for (let corner = 0; corner < 4; ++corner)
    {
        let average_text = '—';
        let stdev_text = '—';
        if (has_stats)
        {
            average_text = stats.corner_average_kg[corner].toFixed(3);
            stdev_text = stats.corner_stdev_kg[corner].toFixed(3);
        }
        let element_id = 'corner-' + (corner + 1);
        document.getElementById(element_id + '-average').textContent = average_text;
        document.getElementById(element_id + '-stdev').textContent = stdev_text;
        renderCornerRange(element_id, stats, corner, has_range);
    }
    if (stats != null && !has_stats)
    {
        note = 'Update the Pi logger to enable corner statistics.';
    }
    else if (has_stats && !has_range)
    {
        note = 'Update the Pi logger to enable corner min/max statistics.';
    }
    document.getElementById('corner-window-note').textContent = note;
}

function renderCornerRange(element_id, stats, corner, has_range)
{
    let graph = document.getElementById(element_id + '-range');
    let range = document.getElementById(element_id + '-range-span');
    let positions = [];
    let descriptions = [];
    let all_within = true;
    for (let kind of ['min', 'max'])
    {
        let readout = document.getElementById(element_id + '-' + kind + '-delta');
        let tick = document.getElementById(element_id + '-' + kind + '-tick');
        tick.hidden = !has_range;
        readout.textContent = '—';
        readout.classList.remove('within-bounds', 'out-of-bounds');
        if (!has_range)
        {
            continue;
        }
        let delta = stats['corner_' + kind + '_kg'][corner] - stats.corner_average_kg[corner];
        // Ignore subtraction roundoff at the inclusive ±0.3 kg boundaries.
        let within = Math.abs(delta) <= CORNER_DEVIATION_LIMIT_KG + 1e-12;
        let magnitude = Math.abs(delta).toFixed(3);
        let text = magnitude == '0.000' ? '0.000' : (delta < 0 ? '−' : '+') + magnitude;
        readout.textContent = text;
        readout.classList.toggle('within-bounds', within);
        readout.classList.toggle('out-of-bounds', !within);
        tick.classList.toggle('out-of-bounds', !within);
        tick.classList.toggle('overflow-low', !within && delta < 0);
        tick.classList.toggle('overflow-high', !within && delta > 0);
        let position = Math.max(0, Math.min(100, 50 + delta/(2*CORNER_DEVIATION_LIMIT_KG)*100));
        tick.style.left = position + '%';
        positions.push(position);
        descriptions.push(kind + ' minus average ' + text + ' kg, ' + (within ? 'within bounds' : 'out of bounds'));
        all_within = all_within && within;
    }
    range.hidden = !has_range;
    if (has_range)
    {
        range.style.left = positions[0] + '%';
        range.style.width = (positions[1] - positions[0]) + '%';
        range.classList.toggle('out-of-bounds', !all_within);
    }
    let description = has_range ? descriptions.join('; ') : 'Waiting for min/max readings';
    description += '. Scale −0.3 to +0.3 kg relative to the 3 s average.';
    graph.setAttribute('aria-label', description);
    graph.title = description;
}

function renderCornerReadout(state, ready)
{
    let has_stats = ready && state.corner_average_kg != null && state.corner_stdev_kg != null;
    copy_corners_button.disabled = !has_stats;
    // Hold the text while selected so live updates cannot disturb manual copying.
    if (document.activeElement == corner_readout)
    {
        return;
    }
    let status = document.getElementById('corner-copy-status');
    if (!has_stats)
    {
        corner_readout.value = '';
        status.textContent = ready ? `Waiting for ${WINDOW_DURATION} s corner statistics` : 'Waiting for live readings';
        return;
    }

    let corner_order = [2, 0, 3, 1];
    let positions = ['top_left', 'top_right', 'bottom_left', 'bottom_right'];
    let lines = [];
    for (let row = 0; row < 4; ++row)
    {
        let corner = corner_order[row];
        let fields =
        [
            corner + 1,
            positions[row],
            state.corners_kg[corner].toFixed(3),
            state.corner_average_kg[corner].toFixed(3),
            state.corner_stdev_kg[corner].toFixed(3)
        ];
        lines.push(fields.join(','));
    }
    corner_readout.value = lines.join('\n');
    status.textContent = 'Live · select the text to hold a snapshot for copying';
}

function holdCornerReadout()
{
    document.getElementById('corner-copy-status').textContent = 'Snapshot held · click outside to resume updates';
}

function copyCornerReadout()
{
    if (copy_corners_button.disabled || !corner_readout.value)
    {
        return;
    }
    corner_readout.focus();
    corner_readout.select();
    corner_readout.setSelectionRange(0, corner_readout.value.length);
    // execCommand also works on the Pi's plain HTTP dashboard.
    let copied = document.execCommand('copy');
    let message = copied ? 'Copied 4 lines · click outside to resume updates' : 'Text selected · use your browser’s Copy command';
    document.getElementById('corner-copy-status').textContent = message;
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

function renderState(state, request_started_at)
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
    renderCornerReadout(state, ready);
    updateSampleCoverage(state, request_started_at);
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
    let request_started_at = performance.now();
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
        renderState(JSON.parse(request.responseText), request_started_at);
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
    let pixel_width = Math.round(width*pixel_ratio);
    let pixel_height = Math.round(height*pixel_ratio);
    if (canvas.width != pixel_width || canvas.height != pixel_height)
    {
        canvas.width = pixel_width;
        canvas.height = pixel_height;
    }
    let context = canvas.getContext('2d');
    context.setTransform(pixel_ratio, 0, 0, pixel_ratio, 0, 0);
    context.clearRect(0, 0, width, height);
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
copy_corners_button.addEventListener('click', copyCornerReadout);
corner_readout.addEventListener('focus', holdCornerReadout);
baseline_input.addEventListener('input', drawChart);
window.addEventListener('resize', drawChart);
window.setInterval(refreshSampleCoverage, 100);
pollStatus();
