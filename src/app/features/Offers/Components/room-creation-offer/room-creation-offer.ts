import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { PrimeUIModules } from '../../../../core/prime.import';

export interface OfferRoomRateDraft {
    id: string;
    season: string;
    seasonAr: string;
    value: string;
}

export interface OfferRoomDraft {
    id: string;
    roomName: string;
    roomNameAr: string;
    rates: OfferRoomRateDraft[];
    isPlaceholder?: boolean;
}

interface RoomFormValue {
    roomName: string;
    roomNameAr: string;
}

interface RateFormValue {
    season: string;
    seasonAr: string;
    value: string;
}

@Component({
    selector: 'app-room-creation-offer',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, PrimeUIModules],
    templateUrl: './room-creation-offer.html',
    styleUrl: './room-creation-offer.css',
})
export class RoomCreationOffer implements OnChanges {
    private readonly fb = new FormBuilder();
    private readonly nonNullableFb = this.fb.nonNullable;

    @Input() visible = false;
    @Input() roomDraft: OfferRoomDraft | null = null;
    @Output() visibleChange = new EventEmitter<boolean>();
    @Output() saveRoom = new EventEmitter<OfferRoomDraft>();
    readonly roomForm = this.nonNullableFb.group({
        roomName: ['', Validators.required],
        roomNameAr: ['', Validators.required],
    });
    readonly rateForm = this.nonNullableFb.group({
        season: [''],
        seasonAr: [''],
        value: ['', [this.optionalRateValueValidator]],
    });
    readonly editRateForm = this.nonNullableFb.group({
        season: [''],
        seasonAr: [''],
        value: ['', [this.optionalRateValueValidator]],
    });
    readonly roomRates = signal<OfferRoomRateDraft[]>([]);
    readonly expandedRateIndex = signal<number | null>(null);

    ngOnChanges(changes: SimpleChanges) {
        if (changes['roomDraft']) {
            this.populateForm(changes['roomDraft'].currentValue ?? null);
        }

        if (changes['visible'] && !changes['visible'].currentValue && !this.roomDraft) {
            this.resetForm();
        }
    }

    get isEditing() {
        return !!this.roomDraft;
    }

    onVisibleChange(visible: boolean) {
        this.visible = visible;
        if (!visible) {
            this.resetForm();
        }
        this.visibleChange.emit(visible);
    }

    close() {
        this.onVisibleChange(false);
    }

    addRoomRate() {
        if (this.rateForm.invalid) {
            this.rateForm.markAllAsTouched();
            return;
        }

        const formValue = this.rateForm.getRawValue();
        const normalizedValue = this.normalizeRateValue(formValue.value);
        const isEmptyRate =
            !formValue.season.trim() &&
            !formValue.seasonAr.trim() &&
            !normalizedValue;

        if (isEmptyRate) {
            return;
        }

        const nextRates = [...this.roomRates()];
        const rate: OfferRoomRateDraft = {
            id: this.generateId('rate'),
            season: formValue.season.trim(),
            seasonAr: formValue.seasonAr.trim(),
            value: normalizedValue,
        };

        nextRates.push(rate);
        this.roomRates.set(nextRates);
        this.resetRateForm();
    }

    editRoomRate(index: number) {
        const rate = this.roomRates()[index];
        if (!rate) {
            return;
        }

        this.expandedRateIndex.set(index);
        this.editRateForm.reset({
            season: rate.season,
            seasonAr: rate.seasonAr,
            value: rate.value,
        } as RateFormValue);
    }

    saveEditedRoomRate(index: number) {
        if (this.editRateForm.invalid) {
            this.editRateForm.markAllAsTouched();
            return;
        }

        const existingRate = this.roomRates()[index];
        if (!existingRate) {
            return;
        }

        const formValue = this.editRateForm.getRawValue();
        const normalizedValue = this.normalizeRateValue(formValue.value);
        const nextRates = [...this.roomRates()];
        nextRates[index] = {
            ...existingRate,
            season: formValue.season.trim(),
            seasonAr: formValue.seasonAr.trim(),
            value: normalizedValue,
        };

        this.roomRates.set(nextRates);
        this.cancelRateEdit();
    }

    removeRoomRate(index: number) {
        const nextRates = this.roomRates().filter((_, rateIndex) => rateIndex !== index);
        this.roomRates.set(nextRates);

        const expandedIndex = this.expandedRateIndex();
        if (expandedIndex === index) {
            this.resetRateForm();
            this.cancelRateEdit();
        } else if (expandedIndex != null && expandedIndex > index) {
            this.expandedRateIndex.set(expandedIndex - 1);
        }
    }

    cancelRateEdit() {
        this.editRateForm.reset({
            season: '',
            seasonAr: '',
            value: '',
        } as RateFormValue);
        this.expandedRateIndex.set(null);
        this.editRateForm.markAsPristine();
        this.editRateForm.markAsUntouched();
    }

    submitRoom() {
        if (this.roomForm.invalid) {
            this.roomForm.markAllAsTouched();
            return;
        }

        const formValue = this.roomForm.getRawValue();
        const room: OfferRoomDraft = {
            id: this.roomDraft?.id ?? this.generateId('room'),
            roomName: formValue.roomName.trim(),
            roomNameAr: formValue.roomNameAr?.trim() ?? '',
            rates: this.roomRates(),
        };

        this.saveRoom.emit(room);
        this.close();
    }

    private populateForm(room: OfferRoomDraft | null) {
        if (!room) {
            this.resetForm();
            return;
        }

        this.roomForm.reset({
            roomName: room.roomName ?? '',
            roomNameAr: room.roomNameAr ?? '',
        } as RoomFormValue);
        this.roomRates.set((room.rates ?? []).map((rate) => ({
            id: rate.id ?? this.generateId('rate'),
            season: rate.season ?? '',
            seasonAr: rate.seasonAr ?? '',
            value: rate.value ?? '',
        })));
        this.resetRateForm();
        this.cancelRateEdit();
        this.roomForm.markAsPristine();
        this.roomForm.markAsUntouched();
    }

    private resetForm() {
        this.roomForm.reset({
            roomName: '',
            roomNameAr: '',
        } as RoomFormValue);
        this.roomRates.set([]);
        this.resetRateForm();
        this.cancelRateEdit();
        this.roomForm.markAsPristine();
        this.roomForm.markAsUntouched();
    }

    private resetRateForm() {
        this.rateForm.reset({
            season: '',
            seasonAr: '',
            value: '',
        } as RateFormValue);
        this.rateForm.markAsPristine();
        this.rateForm.markAsUntouched();
    }

    private generateId(prefix: 'room' | 'rate') {
        return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    private optionalRateValueValidator(control: AbstractControl): ValidationErrors | null {
        const value = control.value;

        if (value == null || value === '') {
            return null;
        }

        const trimmedValue =
            typeof value === 'number'
                ? String(value)
                : typeof value === 'string'
                    ? value.trim()
                    : '';

        if (!trimmedValue) {
            return null;
        }

        if (!/^\d+(\.\d{1,2})?$/.test(trimmedValue)) {
            return { invalidRateValue: true };
        }

        const numericValue = Number(trimmedValue);
        if (!Number.isFinite(numericValue)) {
            return { invalidRateValue: true };
        }

        return null;
    }

    private normalizeRateValue(value: unknown): string {
        if (value == null || value === '') {
            return '';
        }

        return typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
    }
}
