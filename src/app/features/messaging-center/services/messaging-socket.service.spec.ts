import { TestBed } from '@angular/core/testing';

import { MessagingSocketService } from './messaging-socket.service';

describe('MessagingSocketService', () => {
  let service: MessagingSocketService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MessagingSocketService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
