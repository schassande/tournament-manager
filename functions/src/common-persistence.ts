import {PersistentObject} from './persistent-data-model';
import * as admin   from 'firebase-admin';
import dayjs from 'dayjs';

// import * as logger from "firebase-functions/logger";

export async function byId<T extends PersistentObject>(
  collectionName:string,
  id: string,
  firestore: admin.firestore.Firestore): Promise<T|undefined> {
  return (await firestore.collection(collectionName).doc(id).get()).data() as T;
}
export async function byIdRequired<T extends PersistentObject>(
  collectionName:string,
  id: string,
  firestore: admin.firestore.Firestore): Promise<T> {
  const item: T|undefined = await byId<T>(collectionName, id, firestore);
  if (!item) throw new Error(`Wrong ${collectionName} identifier: ${id}`);
  return item;
}

export async function deleteById(collectionName:string,
  id: string,
  firestore: admin.firestore.Firestore): Promise<any> {
  return firestore.collection(collectionName).doc(id).delete().then(wr=> wr.writeTime);
}

/** Creates an object with a generated identifier and current timestamp. */
export async function create<T extends PersistentObject>(
  collectionName:string,
  persistentObject: T,
  firestore: admin.firestore.Firestore): Promise<T> {
  const doc = firestore.collection(collectionName).doc();
  persistentObject.id = doc.id;
  persistentObject.lastChange = dateToEpoch(new Date());
  await doc.set(persistentObject);
  return persistentObject;
}
/** Saves an object with the current timestamp. */
export async function save<T extends PersistentObject>(
  collectionName:string,
  persistentObject: T,
  firestore: admin.firestore.Firestore): Promise<T> {
  persistentObject.lastChange = dateToEpoch(new Date());
  await firestore.collection(collectionName).doc(persistentObject.id).set(persistentObject);
  return persistentObject;
}


export function epochToDate(epoch: number): Date {
  return dayjs.unix(epoch).toDate();
}

export function dateToEpoch(date: Date): number {
  return dayjs(date).unix();
}
