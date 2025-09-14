/** Define an object having an identifier */
export interface WithId {
  id: string; // unique identifier
}

/** Define an object persistent in the database */
export interface PersistentObject extends WithId {
  lastChange: number; // epoch time of the last change
}