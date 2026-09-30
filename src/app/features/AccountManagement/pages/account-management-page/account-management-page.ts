import { CommonModule } from '@angular/common';
import { openRowMenu } from '../../../../shared/utils/row-menu';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MenuItem, MessageService } from 'primeng/api';
import { TableLazyLoadEvent } from 'primeng/table';
import { Observable, Subject, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PrimeUIModules } from '../../../../core/prime.import';
import { AppSearch } from '../../../../shared/Components/app-search/app-search';
import { Button } from '../../../../shared/Components/button/button';
import { ConfirmationPopUp } from '../../../../shared/Components/confirmation-pop-up/confirmation-pop-up';
import { I18nService } from '../../../../shared/i18n/i18n.service';
import { TranslatePipe } from '../../../../shared/i18n/translate.pipe';
import { extractApiErrorMessage } from '../../../../shared/utils/api-error-message';
import { AccountStatus, AccountType, VendorAccount } from '../../models/account.model';
import { AccountsService } from '../../services/accounts.service';
import { AuthService } from '../../../../core/services/auth.service';

type RowAction = 'suspend' | 'activate' | 'delete';

const ACTION_PAST_TENSE: Record<RowAction, string> = {
  suspend: 'suspended',
  activate: 'activated',
  delete: 'deleted',
};

@Component({
  selector: 'app-account-management-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PrimeUIModules,
    AppSearch,
    Button,
    ConfirmationPopUp,
    TranslatePipe,
  ],
  templateUrl: './account-management-page.html',
  styleUrl: './account-management-page.scss',
})
export class AccountManagementPage implements OnInit {
  /** Closes any other row's menu first — see shared/utils/row-menu.ts. */
  readonly openRowMenu = openRowMenu;
  private readonly api = inject(AccountsService);
  private readonly messageService = inject(MessageService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private static readonly ACCOUNT_TYPE: AccountType = 'SUB_ACCOUNT';

  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly rows = signal<VendorAccount[]>([]);
  readonly totalRecords = signal(0);
  readonly pageSize = signal(10);
  private readonly currentPage = signal(1);
  readonly first = computed(() => (this.currentPage() - 1) * this.pageSize());

  // Server-side search (backend matches account name, email and phone).
  readonly searchQuery = signal('');
  private readonly searchInput = new Subject<string>();

  constructor() {
    this.searchInput
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((value) => {
        this.searchQuery.set(value);
        this.load(1);
      });
  }

  onSearchInput(value: string): void {
    this.searchInput.next(value);
  }

  readonly tableRows = computed<(VendorAccount | null)[]>(() =>
    this.loading() ? new Array(this.skeletonRowCount()).fill(null) : this.rows(),
  );

  private readonly skeletonRowCount = computed(() => Math.min(this.pageSize(), 5));

  readonly selectedRow = signal<VendorAccount | null>(null);
  readonly auth = inject(AuthService);

  readonly rowActions = computed<MenuItem[]>(() => {
    this.i18n.loadSeq();
    const row = this.selectedRow();
    // Edit / suspend / delete are all writes — a read-only user gets no row menu at all.
    if (!row || !this.auth.canManage('vendor_staff')) return [];

    const suspended = row.accountStatus !== 'ACTIVE';
    return [
      {
        label: this.i18n.t('accountManagement.action.edit'),
        icon: 'pi pi-pencil',
        command: () => this.editAccount(row),
      },
      {
        label: this.i18n.t(
          suspended ? 'accountManagement.action.activate' : 'accountManagement.action.suspend',
        ),
        icon: suspended ? 'pi pi-check-circle' : 'pi pi-ban',
        command: () => this.askConfirm(suspended ? 'activate' : 'suspend', row),
      },
      {
        label: this.i18n.t('accountManagement.action.delete'),
        icon: 'pi pi-trash',
        command: () => this.askConfirm('delete', row),
      },
    ];
  });

  readonly confirmVisible = signal(false);
  readonly confirmBusy = signal(false);
  private readonly pendingRow = signal<VendorAccount | null>(null);

  private readonly pendingAction = signal<RowAction | null>(null);

  readonly confirmVariant = computed<'primary' | 'danger'>(() =>
    this.pendingAction() === 'delete' ? 'danger' : 'primary',
  );

  readonly confirmTitle = computed(() => {
    this.i18n.loadSeq();
    const action = this.pendingAction();
    return action ? this.i18n.t(`accountManagement.confirm.${action}.title`) : '';
  });

  readonly confirmMessage = computed(() => {
    this.i18n.loadSeq();
    const action = this.pendingAction();
    const row = this.pendingRow();
    if (!action || !row) return '';
    return this.i18n.t(`accountManagement.confirm.${action}.message`).replace('{{name}}', row.name);
  });

  readonly confirmLabel = computed(() => {
    this.i18n.loadSeq();
    const action = this.pendingAction();
    return action ? this.i18n.t(`accountManagement.action.${action}`) : '';
  });

  ngOnInit(): void {
    this.load(1);
  }


  onLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.pageSize();
    this.pageSize.set(rows);
    this.load(Math.floor((event.first ?? 0) / rows) + 1);
  }

  private load(page: number): void {
    this.currentPage.set(page);
    this.loading.set(true);
    this.loadFailed.set(false);

    this.api
      .list({
        page,
        pageSize: this.pageSize(),
        accountType: AccountManagementPage.ACCOUNT_TYPE,
        search: this.searchQuery().trim() || undefined,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.totalRecords.set(res.total || res.data.length);
        },
        error: (err: unknown) => {
          console.error('Failed to load accounts', err);
          this.rows.set([]);
          this.totalRecords.set(0);
          this.loadFailed.set(true);
        },
      });
  }

  addAccount(): void {
    this.router.navigate(['/account-management/create']);
  }

  editAccount(row: VendorAccount): void {
    this.router.navigate(['/account-management/edit', row.id]);
  }

  private askConfirm(action: RowAction, row: VendorAccount): void {
    this.pendingAction.set(action);
    this.pendingRow.set(row);
    this.confirmVisible.set(true);
  }

  cancelConfirm(): void {
    if (this.confirmBusy()) return;
    this.confirmVisible.set(false);
    this.pendingAction.set(null);
    this.pendingRow.set(null);
  }

  confirmAction(): void {
    const action = this.pendingAction();
    const row = this.pendingRow();
    if (!action || !row) return;

    const request: Observable<unknown> =
      action === 'delete'
        ? this.api.deleteAccount(row.id)
        : this.api.updateAccountStatus(row.id, action === 'suspend' ? 'SUSPENDED' : 'ACTIVE');

    this.confirmBusy.set(true);
    request.pipe(finalize(() => this.confirmBusy.set(false))).subscribe({
      next: () => {
        this.confirmVisible.set(false);
        this.messageService.add({
          severity: 'success',
          summary: this.i18n.t(`accountManagement.toast.${ACTION_PAST_TENSE[action]}Summary`),
          detail: this.i18n
            .t(`accountManagement.toast.${ACTION_PAST_TENSE[action]}Detail`)
            .replace('{{name}}', row.name),
          life: 4000,
        });
        this.pendingAction.set(null);
        this.pendingRow.set(null);
        this.load(action === 'delete' ? 1 : this.currentPage());
      },
      error: (err: HttpErrorResponse) => {
        console.error(`Failed to ${action} account`, err);
        this.confirmVisible.set(false);
        this.messageService.add({
          severity: 'error',
          summary: this.i18n.t(`accountManagement.toast.${action}Failed`),
          detail:
            extractApiErrorMessage(err) ??
            this.i18n.t('accountManagement.toast.genericErrorDetail'),
          life: 8000,
          closable: true,
        });
      },
    });
  }

  statusClass(status: AccountStatus): string {
    return `account-management__status account-management__status--${(status ?? '').toLowerCase()}`;
  }

  statusLabel(status: AccountStatus): string {
    this.i18n.loadSeq();
    const key = `accountManagement.status.${status}`;
    const label = this.i18n.t(key);
    return label === key ? status : label;
  }

  formatLastLogin(iso: string | null): string {
    if (!iso) return '—';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '—';
    const datePart = date.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
    const timePart = date
      .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      .toLowerCase();
    return `${datePart} | ${timePart}`;
  }
}
