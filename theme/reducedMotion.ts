import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Keep native and web motion in sync with the user's OS preference. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active) setReduced(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
