/**
 * Heterogeneous-interaction scenarios.
 *
 * Each scenario is a two-device configuration in which the first device is the
 * externally exposed one and the second is an internal peer. The question
 * asked of the checker is always the same:
 *
 *     Is there a reachable state in which the TARGET device is compromised?
 *
 * The answer is computed by reachability, not asserted. Because the only route
 * to compromise for a non-exposed device is the lateral-infection transition,
 * a positive answer is a proof that the interaction guard admits propagation
 * between those two classes, and a negative answer is a proof that it does not.
 *
 * This is what demonstrates that propagation depends on the characteristics of
 * BOTH devices — class, zone, and hardening — rather than on the target alone.
 */

import type { DeviceProfile } from './net'
import { DEFAULT_PARAMETERS } from './colour'
import { infectionStrength, zoneReachable, CLASS_LABEL } from './colour'

export interface Scenario {
  id: string
  title: string
  /** What the scenario is designed to show. */
  rationale: string
  source: DeviceProfile
  target: DeviceProfile
  /** What the guard should decide, stated before the checker runs. */
  expectPropagation: boolean
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'SC-1',
    title: 'Compromised gateway → vulnerable actuator (same zone)',
    rationale:
      'The gateway holds the management plane and shared credentials, so its route to an actuator is strong (2). The thermostat is only standard-hardened (1). 2 > 1, so propagation is admitted.',
    source: { id: 'GW-1', cls: 'gateway', zone: 'building', hard: 0, exposed: true },
    target: { id: 'TH-1', cls: 'thermostat', zone: 'building', hard: 1, exposed: false },
    expectPropagation: true,
  },
  {
    id: 'SC-2',
    title: 'Compromised gateway → hardened industrial controller',
    rationale:
      'The same compromised gateway, and the plant zone is routable from the building zone. But the gateway→PLC route is weak (1) and the controller is fully hardened (2). 1 > 2 is false, so the guard denies propagation. Reachability alone is not sufficient — the pair relation decides.',
    source: { id: 'GW-1', cls: 'gateway', zone: 'building', hard: 0, exposed: true },
    target: { id: 'PLC-1', cls: 'plc', zone: 'plant', hard: 2, exposed: false },
    expectPropagation: false,
  },
  {
    id: 'SC-3',
    title: 'Compromised sensor → temperature actuator',
    rationale:
      'The interaction raised in supervision. An actuator that consumes a sensor topic without validating the payload gives the sensor a strong route (2) against standard hardening (1). Propagation is admitted — and note the sensor could not reach a camera at all.',
    source: { id: 'SEN-1', cls: 'sensor', zone: 'building', hard: 0, exposed: true },
    target: { id: 'TH-2', cls: 'thermostat', zone: 'building', hard: 1, exposed: false },
    expectPropagation: true,
  },
  {
    id: 'SC-4',
    title: 'Compromised sensor → smart camera',
    rationale:
      'Same compromised sensor, same zone, same hardening as the actuator above — but no route exists between these classes (strength 0). The difference in outcome is attributable to device class alone, which is precisely what a state-only colour set could not express.',
    source: { id: 'SEN-1', cls: 'sensor', zone: 'building', hard: 0, exposed: true },
    target: { id: 'CAM-1', cls: 'camera', zone: 'building', hard: 1, exposed: false },
    expectPropagation: false,
  },
  {
    id: 'SC-5',
    title: 'Cross-zone: compromised clinical monitor → plant controller',
    rationale:
      'Segmentation, not susceptibility. The clinical and plant zones are mutually unreachable under the segment policy, so the guard fails on the zone conjunct before susceptibility is ever considered.',
    source: { id: 'MON-1', cls: 'monitor', zone: 'clinical', hard: 0, exposed: true },
    target: { id: 'PLC-2', cls: 'plc', zone: 'plant', hard: 0, exposed: false },
    expectPropagation: false,
  },
  {
    id: 'SC-6',
    title: 'Cross-zone permitted: compromised gateway → clinical monitor',
    rationale:
      'The building zone adjoins the clinical VLAN, and an unpatched monitor (0) falls to the gateway route (1). Shows the zone relation permitting as well as denying — the control is a policy, not a blanket block.',
    source: { id: 'GW-2', cls: 'gateway', zone: 'building', hard: 0, exposed: true },
    target: { id: 'MON-2', cls: 'monitor', zone: 'clinical', hard: 0, exposed: false },
    expectPropagation: true,
  },
]

/**
 * The guard's decision for a scenario, evaluated directly.
 *
 * Reported alongside the reachability result so a reader can see that the
 * explored behaviour agrees with the declared guard.
 */
export function guardDecision(scenario: Scenario): {
  zoneOk: boolean
  strength: number
  hardening: number
  admits: boolean
  explanation: string
} {
  const zoneOk = zoneReachable(scenario.source.zone, scenario.target.zone)
  const strength = infectionStrength(scenario.target.cls, scenario.source.cls)
  const hardening = scenario.target.hard
  const admits = zoneOk && strength > hardening

  const explanation = !zoneOk
    ? `zone ${scenario.source.zone} cannot route to ${scenario.target.zone}`
    : strength === 0
      ? `no route exists from ${CLASS_LABEL[scenario.source.cls]} to ${CLASS_LABEL[scenario.target.cls]}`
      : strength > hardening
        ? `route strength ${strength} overcomes hardening ${hardening}`
        : `route strength ${strength} does not overcome hardening ${hardening}`

  return { zoneOk, strength, hardening, admits, explanation }
}

export const SCENARIO_PARAMETERS = DEFAULT_PARAMETERS
