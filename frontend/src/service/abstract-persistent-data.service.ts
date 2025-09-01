import { inject, Injectable } from '@angular/core';
import { PersistentObject } from '../data.model';
import { from, map, Observable } from 'rxjs';
import { Firestore, collection, collectionData, doc, setDoc, deleteDoc, docData, CollectionReference, DocumentData, Query } from '@angular/fire/firestore';
import { getDocs, limit, query, QueryDocumentSnapshot, QuerySnapshot } from 'firebase/firestore';

@Injectable({
  providedIn: 'root'
})
export abstract class AbstractPersistentDataService<T extends PersistentObject>{

  private firestore = inject(Firestore)

  protected abstract getCollectionName(): string;

  protected adjustItemOnLoad(item: T): T { return item;}

  protected itemsCollection(): CollectionReference<DocumentData,DocumentData> {
    return collection(this.firestore, this.getCollectionName());
  }
  public all(): Observable<T[]> {
    return collectionData(this.itemsCollection(), { idField: 'id' }) as Observable<T[]>;
  }

  public byId(id: string): Observable<T | undefined> {
    const path = `${this.getCollectionName()}/${id}`;
    const itemDoc = doc(this.firestore, path);
    return docData(itemDoc, { idField: 'id' }) as Observable<T | undefined>;
  }
  public save(item: T): Observable<T> {
    if (item.id) {
      console.log(`Updating ${this.getCollectionName()}:${item.id}...`);
      return this.update(item);
    } else {
      console.log(`Creating ${this.getCollectionName()}:${item.id}...`);
      return this.create(item);
    }
  }

  private create(item: T): Observable<T> {
    // Génère un ID unique
    item.id = doc(this.itemsCollection()).id;
    console.log(`Creating new item with ID: ${item.id}`);
    item.lastChange = new Date().getTime();
    const itemDoc = doc(this.firestore, `${this.getCollectionName()}/${item.id}`);
    console.log(`Document ID: ${itemDoc.id}`);
    return from(setDoc(itemDoc, item).then(() => item));
  }

  private update(item: T): Observable<T> {
    item.lastChange = new Date().getTime();
    const itemDoc = doc(this.firestore, `${this.getCollectionName()}/${item.id}`);
    return from(setDoc(itemDoc, item).then(() => item));
  }

  public delete(id: string): Promise<void> {
    const itemDoc = doc(this.firestore, `${this.getCollectionName()}/${id}`);
    return deleteDoc(itemDoc);
  }

  public queryOne(q: Query): Observable<T|null> {
    return from(getDocs(query(q, limit(1))) as Promise<QuerySnapshot<T>>).pipe(
      map(this.snapshotOneToObs.bind(this))
    );
  }

  public query(q: Query): Observable<T[]> {
    return from(getDocs(query(q)) as Promise<QuerySnapshot<T>>).pipe(
      map(this.snapshotToObs.bind(this))
    );
  }
  private snapshotOneToObs(qs: QuerySnapshot<T>): T|null {
    const datas: T[] = [];
    qs.forEach((qds: QueryDocumentSnapshot<T>) => {
        const data: T = qds.data();
        if (data) {
            // store id inside persistent object
            data.id = qds.id;
            this.adjustItemOnLoad(data);
        }
        datas.push(data);
    });
    if (datas.length > 0) {
        return datas[0];
    } else {
        return null;
    }
  }
  private snapshotToObs(qs: QuerySnapshot<T>): T[] {
    const datas: T[] = [];
    qs.forEach((qds: QueryDocumentSnapshot<T>) => {
      const data: T = qds.data();
      if (data) {
          // store id inside persistent object
          data.id = qds.id;
          this.adjustItemOnLoad(data);
      }
      datas.push(data);
    });
    return datas;
  }
  public filter(obs: Observable<T[]>, filter: PersistentDataFilter<T>) {
    return obs.pipe(
        map((result: T[]) => result.filter( (elem: T) => filter(elem)))
    );
  }
  public stringContains(elem: string, text: string): boolean {
    return elem !== undefined && text !== undefined && text.toLowerCase().indexOf(elem.toLowerCase()) >= 0;
  }
}
export interface PersistentDataFilter<T extends PersistentObject> {
  (data: T): boolean;
}

