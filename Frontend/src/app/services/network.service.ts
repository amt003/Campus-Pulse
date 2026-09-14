import { Injectable, signal } from '@angular/core';
import { BehaviorSubject, Observable, fromEvent, merge } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private readonly onlineSubject = new BehaviorSubject<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  readonly isOnline$ = this.onlineSubject.asObservable();
  readonly isOnline = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  constructor() {
    if (typeof window !== 'undefined') {
      merge(
        fromEvent(window, 'online').pipe(map(() => true)),
        fromEvent(window, 'offline').pipe(map(() => false))
      ).subscribe((status) => {
        this.onlineSubject.next(status);
        this.isOnline.set(status);
      });
    }
  }

  isOnlineObservable(): Observable<boolean> {
    return this.isOnline$;
  }
}
