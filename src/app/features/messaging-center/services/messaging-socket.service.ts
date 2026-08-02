import { Injectable, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class MessagingSocketService implements OnDestroy {
  private socket: Socket | null = null;
  private readonly joinedTicketRooms = new Set<string>();
  private listenersBound = false;
  readonly ticketUpdated$ = new Subject<any>();
  readonly messageCreated$ = new Subject<any>();

  constructor(
    private readonly authService: AuthService
  ) { }

  connect(): void {
    const token = this.authService.getAccessToken();
    if (!token) {
      console.error('Messaging Socket : JWT token not found.');
      return;
    }
    if (this.socket?.connected) {
      this.rejoinRooms();
      return;
    }
    if (this.socket && !this.socket.connected) {
      this.socket.connect();
      return;
    }
    const socketUrl =
      `${environment.backendUrl.replace(/\/$/, '')}/messaging-center`;

    this.socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      this.rejoinRooms();
    });

    this.socket.on('disconnect', () => {
      console.log('Messaging Socket Disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket Connection Error', error);
    });
    this.bindListeners();
  }

  private bindListeners(): void {
    if (!this.socket || this.listenersBound) {
      return;
    }

    this.listenersBound = true;

    this.socket.on(
      'user.ticket.updated',
      (ticket) => {
        this.ticketUpdated$.next(ticket);
      }
    );

    this.socket.on(
      'user.ticket.message.created',
      (payload) => {
        this.messageCreated$.next(payload);
      }
    );

    this.socket.onAny((event, payload) => {
      console.log('Socket Event =>', event);
      console.log(payload);
    });
  }

  private rejoinRooms(): void {
    if (!this.socket) {
      return;
    }
    this.socket.emit('subscribe_notifications');
    this.joinedTicketRooms.forEach(ticketId => {
      this.socket!.emit('join_ticket', {
        ticketId
      });
    });
  }

  joinTicketRoom(ticketId: string): void {
    if (!ticketId) {
      return;
    }
    this.joinedTicketRooms.add(ticketId);
    this.socket?.emit('join_ticket', {
      ticketId
    });
  }

  leaveTicketRoom(ticketId: string): void {
    if (!ticketId) {
      return;
    }
    this.joinedTicketRooms.delete(ticketId);
    this.socket?.emit('leave_ticket', {
      ticketId
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.listenersBound = false;
    this.joinedTicketRooms.clear();
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
