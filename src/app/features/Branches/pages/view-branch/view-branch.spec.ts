import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ViewBranch } from './view-branch';

describe('ViewBranch', () => {
  let component: ViewBranch;
  let fixture: ComponentFixture<ViewBranch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ViewBranch]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ViewBranch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
