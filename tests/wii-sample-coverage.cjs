let assert = require('node:assert/strict');
let fs = require('node:fs');
let vm = require('node:vm');
let elements = {};
let now_ms = 1000;
for (let id of ['record', 'baseline', 'chart', 'corner-readout', 'copy-corners',
                'sample-count', 'sample-freshness', 'sample-coverage', 'sample-coverage-fill',
                'sample-age-average', 'sample-age-min', 'sample-age-max',
                'battery', 'battery-label', 'battery-fill'])
{
    elements[id] = {textContent: '', style: {}, attributes: {}};
}
let delayed = false;
let battery_classes = new Set();
elements.battery.classList =
{
    toggle: function (name, enabled)
    {
        if (enabled)
        {
            battery_classes.add(name);
        }
        else
        {
            battery_classes.delete(name);
        }
    }
};
elements.battery.setAttribute = function (name, value)
{
    elements.battery.attributes[name] = value;
};
elements['sample-coverage'].setAttribute = function (name, value)
{
    elements['sample-coverage'].attributes[name] = value;
};
elements['sample-coverage'].parentElement =
{
    classList:
    {
        toggle: function (name, value) { delayed = value; }
    }
};
let context = vm.createContext(
{
    document: {getElementById: function (id) { return elements[id]; }},
    performance: {now: function () { return now_ms; }}
});
let source = fs.readFileSync('src/wii/dashboard.js', 'utf8');
vm.runInContext(source.split("record_button.addEventListener('click'")[0], context);

function update(state, request_started_at)
{
    context.state = state;
    context.request_started_at = request_started_at;
    vm.runInContext('last_state = state; updateSampleCoverage(state, request_started_at);', context);
}

let state =
{
    live: true, connected: true, taring: false,
    sample_time: 1, run_id: 'test', load_samples: 27,
    sample_age_ms: 80, load_average_kg: 10
};
update(state);
assert.equal(elements['sample-count'].textContent, '27/30 samples · 90%');
assert.equal(elements['sample-coverage-fill'].style.width, '90%');
assert.equal(elements['sample-coverage'].attributes['aria-valuenow'], '90');
assert.equal(elements['sample-freshness'].textContent, 'Latest sample: 80 ms ago');
assert.equal(delayed, false);

// The timer advances age without a response; control re-renders cannot rewind it.
now_ms += 600;
vm.runInContext('renderSampleCoverage();', context);
assert.match(elements['sample-freshness'].textContent, /680 ms ago.*updates delayed.*last received window/);
assert.equal(delayed, true);
update(state);
assert.match(elements['sample-freshness'].textContent, /680 ms ago/);
now_ms += 2000;
update({live: false});
assert.match(elements['sample-freshness'].textContent, /2.7 s ago/);
assert.equal(elements['sample-count'].textContent, '27/30 samples · 90%');

// Transport delay contributes to age, regardless of the Pi's epoch timestamp.
state = {...state, sample_time: 9999999999, load_samples: 31};
update(state, now_ms - 700);
assert.match(elements['sample-freshness'].textContent, /780 ms ago.*updates delayed/);
assert.equal(elements['sample-count'].textContent, '31/30 samples · 100%');
assert.equal(elements['sample-coverage-fill'].style.width, '100%');

update({...state, taring: true});
assert.match(elements['sample-count'].textContent, /—\/30/);
assert.equal(elements['sample-coverage-fill'].style.width, '0%');
state = {...state, sample_time: 2, load_samples: 6, sample_age_ms: 50, load_average_kg: null};
update(state);
assert.equal(elements['sample-count'].textContent, '6/30 samples · 20%');
assert.match(elements['sample-freshness'].textContent, /50 ms ago.*collecting 3 s/);
assert.equal(delayed, false);

update({...state, sample_age_ms: undefined}, now_ms);
assert.match(elements['sample-freshness'].textContent, /unavailable.*update the Pi dashboard/);
assert.equal(delayed, true);
update({...state, connected: false});
assert.match(elements['sample-freshness'].textContent, /waiting for readings/);

// Age statistics describe browser freshness observations, independently of acquisition cadence.
now_ms = 10000;
state = {...state, sample_time: 10, sample_age_ms: 20};
update(state);
assert.equal(elements['sample-age-average'].textContent, '—');
vm.runInContext('refreshSampleCoverage();', context);
now_ms += 100;
state = {...state, sample_time: 11, sample_age_ms: 40};
update(state);
vm.runInContext('refreshSampleCoverage();', context);
now_ms += 100;
state = {...state, sample_time: 12, sample_age_ms: 90};
update(state);
vm.runInContext('refreshSampleCoverage();', context);
assert.equal(elements['sample-age-average'].textContent, '50 ms');
assert.equal(elements['sample-age-min'].textContent, '20 ms');
assert.equal(elements['sample-age-max'].textContent, '90 ms');
update(state);
vm.runInContext('renderSampleCoverage(); renderSampleCoverage();', context);
assert.equal(elements['sample-age-average'].textContent, '50 ms', 'Extra renders must not add observations.');

now_ms = 13000;
vm.runInContext('renderSampleCoverage();', context);
assert.equal(elements['sample-age-average'].textContent, '65 ms');
assert.equal(elements['sample-age-min'].textContent, '40 ms', 'The observation at the cutoff must expire.');
now_ms = 13200;
vm.runInContext('renderSampleCoverage();', context);
assert.equal(elements['sample-age-average'].textContent, '—');
update({live: false});
vm.runInContext('refreshSampleCoverage();', context);
assert.equal(elements['sample-age-average'].textContent, '3.1 s', 'A stall must contribute increasing age.');
assert.equal(elements['sample-age-max'].textContent, '3.1 s');

state = {...state, run_id: 'restarted', sample_age_ms: 50};
update(state);
assert.equal(elements['sample-age-max'].textContent, '—', 'Logger restart must clear age history.');
vm.runInContext('refreshSampleCoverage();', context);
assert.equal(elements['sample-age-min'].textContent, '50 ms');
now_ms += 90000;
vm.runInContext('refreshSampleCoverage();', context);
assert.equal(elements['sample-age-min'].textContent, '90.0 s', 'A paused browser must not keep old observations.');
update({...state, taring: true});
assert.equal(elements['sample-age-max'].textContent, '—');

for (let percent of [80, 100, 21, 20, 0])
{
    context.state = {live: true, connected: true, battery_percent: percent};
    vm.runInContext('renderBattery(state);', context);
    assert.equal(elements['battery-fill'].style.width, percent + '%');
    assert.equal(battery_classes.has('available'), true);
    assert.equal(battery_classes.has('low'), percent <= 20);
    assert.equal(elements['battery-label'].textContent, 'Battery ' + percent + '%' + (percent <= 20 ? ' · low' : ''));
    assert.match(elements.battery.attributes['aria-label'], new RegExp(percent + '%'));
}
for (let battery_state of [{live: false, connected: true, battery_percent: 80},
                           {live: true, connected: false, battery_percent: 80},
                           {live: true, connected: true}])
{
    context.state = battery_state;
    vm.runInContext('renderBattery(state);', context);
    assert.equal(elements['battery-label'].textContent, 'Battery —');
    assert.equal(elements['battery-fill'].style.width, '0%');
    assert.equal(battery_classes.has('available'), false);
    assert.equal(battery_classes.has('low'), false);
}
console.log('PASS: sample coverage and freshness; rolling age average/min/max; stalls and resets; battery percentage, low threshold, empty battery, and unavailable/offline states.');
