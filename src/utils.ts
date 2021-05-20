// Copyright (c) 2021 Christophe Bedard
// See LICENSE file for details.

/**
 * Count the number of capture groups in a regex.
 *
 * @param regex the regex
 * @returns the number of capture groups
 */
export function count_capture_groups(regex: RegExp): number {
  // From: https://stackoverflow.com/a/16046903
  return new RegExp(`${regex.toString()}|`).exec('')!.length - 1;
}
