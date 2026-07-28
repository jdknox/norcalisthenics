'use strict';

/*
> [!WARNING]
> ⚠️ **AI-gerenated Code:**
*/

window.workout_exercise_library = {
  exercises: [
    {
      name: 'Ring Pushups Inclined',
      mode: 'ladder',
      setup: 'rings lower shin, body 30~45°, feet floor',
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]
    },
    {
      name: 'Ring Row Inclined',
      mode: 'ladder',
      setup: 'body 30~45° · grip neutral · range chest to rings',
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 5]]
    },
    {
      name: 'Handle Full Pushups',
      mode: 'ladder',
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1, 2, 3], [1, 2, 3], [1, 2, 3]]
    },
    {
      name: 'Floor Full Pushups',
      mode: 'ladder',
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]
    },
    {
      name: 'Hanging Knee Raise',
      mode: 'straight',
      restSet: 120,
      defaultTargets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }]
    },
    {
      name: 'Banded Hip Bridges',
      mode: 'weighted',
      setup: 'band at hips · anchor floor · lying',
      restSet: 120,
      defaultTargets: [{ reps: 8, load: 15 }, { reps: 12, load: 10 }, { reps: 10, load: 10 }]
    }
  ],
  sampleWorkout: {
    name: 'Friday Upper',
    exercises: [
      {
        name: 'Ring Inclined Pushups',
        mode: 'straight',
        setup: 'rings lower shin, body 30~45°, feet floor',
        restSet: 150,
        targets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }]
      },
      {
        name: 'Ring Row',
        mode: 'straight',
        setup: 'body 30~45° · grip neutral · range chest to rings',
        restSet: 150,
        targets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }]
      },
      {
        name: 'Handle Full Pushups',
        mode: 'ladder',
        restSet: 150,
        restRung: 20,
        ladders: [[1, 2, 3], [1, 2, 3], [1, 2, 3]]
      },
      {
        name: 'Hanging Knee Raise',
        mode: 'straight',
        restSet: 120,
        targets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }]
      },
      {
        name: 'Banded Hip Bridges',
        mode: 'weighted',
        setup: 'band at hips · anchor floor · lying',
        restSet: 120,
        targets: [{ reps: 8, load: 15 }, { reps: 12, load: 10 }, { reps: 10, load: 10 }],
        unit: 'kg'
      }
    ]
  },
  sampleWorkoutSource: [
    '{',
    "    name: 'Friday Upper',",
    '    exercises: [',
    '      {',
    "        name: 'Ring Inclined Pushups',",
    "        mode: 'straight',",
    "        setup: 'rings lower shin, body 30~45°, feet floor',",
    '        restSet: 150,',
    '        targets: [{ reps: 12 }, { reps: 12 }, { reps: 12 }]',
    '      },',
    '      {',
    "        name: 'Ring Row',",
    "        mode: 'straight',",
    "        setup: 'body 30~45° · grip neutral · range chest to rings',",
    '        restSet: 150,',
    '        targets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }]',
    '      },',
    '      {',
    "        name: 'Handle Full Pushups',",
    "        mode: 'ladder',",
    '        restSet: 150,',
    '        restRung: 20,',
    '        ladders: [[1, 2, 3], [1, 2, 3], [1, 2, 3]]',
    '      },',
    '      {',
    "        name: 'Hanging Knee Raise',",
    "        mode: 'straight',",
    '        restSet: 120,',
    '        targets: [{ reps: 6 }, { reps: 6 }, { reps: 6 }]',
    '      },',
    '      {',
    "        name: 'Banded Hip Bridges',",
    "        mode: 'weighted',",
    "        setup: 'band at hips · anchor floor · lying',",
    '        restSet: 120,',
    '        targets: [{ reps: 8, load: 15 }, { reps: 12, load: 10 }, { reps: 10, load: 10 }],',
    "        unit: 'kg'",
    '      }',
    '    ]',
    '  }'
  ].join('\n')
};
