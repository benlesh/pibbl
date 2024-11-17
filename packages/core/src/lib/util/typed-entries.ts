// eslint-disable-next-line ts/no-empty-object-type
export function typedEntries<T extends {}>(obj: T) {
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}
