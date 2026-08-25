'use strict';

window.workout_exercise_library = {
  exercises: [
    {
      name: "Ring Pushups Inclined",
      mode: "ladder",
      setup: "rings lower shin, body 30~45°, feet floor",
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1,2,3,4],[1,2,3,4],[1,2,3,4]]
    },
    {
      name: "Ring Row Inclined",
      mode: "ladder",
      setup: "body 30~45° · grip neutral · range chest to rings",
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1,2,3,4],[1,2,3,4],[1,2,3,5]]
    },
    {
      name: "Handle Full Pushups",
      mode: "ladder",
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1,2,3],[1,2,3],[1,2,3]]
    },
    {
      name: "Floor Full Pushups",
      mode: "ladder",
      restSet: 120,
      restRung: 20,
      defaultLadders: [[1,2,3,4],[1,2,3,4],[1,2,3,4]]
    },
    {
      name: "Hanging Knee Raise",
      mode: "straight",
      restSet: 120,
      defaultTargets: [
        { reps: 6 },
        { reps: 6 },
        { reps: 6 }
      ]
    },
    {
      name: "Banded Hip Bridges",
      mode: "weighted",
      setup: "band at hips · anchor floor · lying",
      restSet: 120,
      defaultTargets: [
        { reps: 8, load: 15 },
        { reps: 12, load: 10 },
        { reps: 10, load: 10 }
      ]
    },
    {
      name: "Scapular Pull-up",
      mode: "weighted",
      restSet: 120,
      unit: "10",
      defaultTargets: [
        { reps: 12, load: 10 },
        { reps: 12, load: 10 },
        { reps: 12, load: 10 }
      ]
    }
  ]
};
