'use strict';

window.workout_exercise_library = {
  exercises: [
    {
      name: "Ring Pushups Inclined",
      mode: "ladder",
      setup: "rings lower shin, body 30~45°, feet floor",
      rest_set: 120,
      rest_rung: 20,
      default_ladders: [[1,2,3,4],[1,2,3,4],[1,2,3,4]]
    },
    {
      name: "Ring Row Inclined",
      mode: "ladder",
      setup: "body 30~45° · grip neutral · range chest to rings",
      rest_set: 120,
      rest_rung: 20,
      default_ladders: [[1,2,3,4],[1,2,3,4],[1,2,3,5]]
    },
    {
      name: "Handle Full Pushups",
      mode: "ladder",
      rest_set: 120,
      rest_rung: 20,
      default_ladders: [[1,2,3],[1,2,3],[1,2,3]]
    },
    {
      name: "Floor Full Pushups",
      mode: "ladder",
      rest_set: 120,
      rest_rung: 20,
      default_ladders: [[1,2,3,4],[1,2,3,4],[1,2,3,4]]
    },
    {
      name: "Hanging Knee Raise",
      mode: "straight",
      rest_set: 120,
      default_targets: [
        { reps: 6 },
        { reps: 6 },
        { reps: 6 }
      ]
    },
    {
      name: "Banded Hip Bridges",
      mode: "weighted",
      setup: "band at hips · anchor floor · lying",
      rest_set: 120,
      default_targets: [
        { reps: 8, load: 15 },
        { reps: 12, load: 10 },
        { reps: 10, load: 10 }
      ]
    },
    {
      name: "Scapular Pull-up",
      mode: "weighted",
      rest_set: 120,
      default_targets: [
        { reps: 12, load: 10 },
        { reps: 12, load: 10 },
        { reps: 12, load: 10 }
      ]
    }
  ]
};
