/**
 * Shared mutable simulation state (ships, berths, containers).
 * Used by simulationService and berthService to avoid circular imports.
 */
export const portState = {
  ships: [],
  berths: [],
  containers: 0,
};
