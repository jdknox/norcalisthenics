'use strict';

window.workout_sample_workout = {
  name: 'Friday Upper',
  exercises: [
    {
      name: 'Ring Inclined Pushups',
      mode: 'straight',
      setup: 'rings lower shin, body 30~45°, feet floor',
      rest_set: 150,
      targets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }]
    },
    {
      name: 'Ring Row',
      mode: 'straight',
      setup: 'body 30~45° · grip neutral · range chest to rings',
      rest_set: 150,
      targets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }]
    },
    {
      name: 'Handle Full Pushups',
      mode: 'ladder',
      rest_set: 150,
      rest_rung: 20,
      ladders: [[1, 2, 3], [1, 2, 3], [1, 2, 3]]
    },
    {
      name: 'Hanging Knee Raise',
      mode: 'straight',
      rest_set: 120,
      targets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }]
    },
    {
      name: 'Banded Hip Bridges',
      mode: 'weighted',
      setup: 'band at hips · anchor floor · lying',
      rest_set: 120,
      targets: [{ reps: 8, load: 15 }, { reps: 12, load: 10 }, { reps: 10, load: 10 }],
      unit: 'kg'
    }
  ]
};
