import { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';

import type { Step, StepStatus } from '../domain/transfer';
import { color, radius, space } from '../theme/tokens';
import { type } from '../theme/type';
import { Pill } from './primitives';

/**
 * The identity mark, unrolled.
 *
 * Gold behind the current step, hairline ahead of it — the boundary is always where
 * the transfer actually is. Five discrete rails, not a progress bar pretending to
 * know something it can't.
 */

interface RouteStep {
  readonly step: Step;
  readonly title: string;
  readonly detail: string;
  readonly badge?: string;
  readonly extra?: React.ReactNode;
}

export function RouteLine({ steps }: { steps: readonly RouteStep[] }) {
  return (
    <View style={{ paddingLeft: 30 }}>
      {steps.map((s, i) => (
        <RouteStepView key={s.step.id} item={s} last={i === steps.length - 1} />
      ))}
    </View>
  );
}

function RouteStepView({ item, last }: { item: RouteStep; last: boolean }) {
  const { step } = item;
  const done = step.status === 'done';
  const live = step.status === 'live';
  const failed = step.status === 'failed';

  return (
    <View style={{ position: 'relative', paddingBottom: last ? 0 : 22 }}>
      {!last ? (
        <View
          style={{
            position: 'absolute',
            left: -30,
            top: 14,
            bottom: -8,
            width: 1,
            backgroundColor: done ? color.gold : color.line,
          }}
        />
      ) : null}

      <Node status={step.status} />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 3 }}>
        <Text
          style={[
            type.bodyStrong,
            { fontSize: 13.5 },
            step.status === 'wait' ? { color: color.mist, fontWeight: '400' } : null,
            failed ? { color: color.paper } : null,
          ]}
        >
          {item.title}
        </Text>
        {item.badge ? <Pill tone={live ? 'live' : 'done'} label={item.badge} /> : null}
      </View>

      <Text style={[type.label, { fontSize: 11.5 }]}>{item.detail}</Text>
      {item.extra ? <View style={{ marginTop: 9 }}>{item.extra}</View> : null}
    </View>
  );
}

function Node({ status }: { status: StepStatus }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status !== 'live') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.62, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulse]);

  const border =
    status === 'done' ? color.gold : status === 'live' ? color.goldBright : status === 'failed' ? color.error : color.line;
  const fill = status === 'done' ? color.gold : status === 'failed' ? color.error : color.void;

  return (
    <View
      style={{
        position: 'absolute',
        left: -36,
        top: 3,
        width: 13,
        height: 13,
        borderRadius: 7,
        borderWidth: 1.5,
        borderColor: border,
        backgroundColor: fill,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {status === 'done' ? <Tick /> : null}
      {status === 'failed' ? (
        <Text style={{ fontSize: 8, fontWeight: '700', color: color.void, lineHeight: 9 }}>×</Text>
      ) : null}
      {status === 'live' ? (
        <Animated.View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color.goldBright,
            transform: [{ scale: pulse }],
          }}
        />
      ) : null}
    </View>
  );
}

function Tick() {
  return (
    <View style={{ width: 6, height: 3.5, transform: [{ rotate: '-45deg' }], marginTop: -1.5 }}>
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: 1.6, height: 3.5, backgroundColor: color.void }} />
      <View style={{ position: 'absolute', left: 0, bottom: 0, width: 6, height: 1.6, backgroundColor: color.void }} />
    </View>
  );
}

/** The horizontal preview on screens 04 and 08 — sets the expectation 09 fulfils. */
export function RouteMini({ labels, filled }: { labels: readonly string[]; filled: number }) {
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {labels.map((label, i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', flex: i === 0 ? 0 : 1 }}>
            {i > 0 ? (
              <View style={{ flex: 1, height: 1, backgroundColor: i <= filled ? color.gold : color.line }} />
            ) : null}
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: i < filled ? color.gold : color.line,
                backgroundColor: i < filled ? color.gold : color.void,
              }}
            />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', marginTop: space.sm }}>
        {labels.map((label, i) => (
          <Text
            key={label}
            style={[
              type.label,
              {
                flex: 1,
                fontSize: 9.5,
                textAlign: i === 0 ? 'left' : i === labels.length - 1 ? 'right' : 'center',
              },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Progress rail — segments, not a percentage. How much is left, not how much is done. */
export function Rail({ total, complete }: { total: number; complete: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginBottom: space.base }}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i < complete ? color.gold : color.line,
          }}
        />
      ))}
    </View>
  );
}

export { radius };
