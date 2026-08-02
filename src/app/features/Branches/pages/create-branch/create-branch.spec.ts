import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateBranch } from './create-branch';

describe('CreateBranch', () => {
  let component: CreateBranch;
  let fixture: ComponentFixture<CreateBranch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateBranch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CreateBranch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
