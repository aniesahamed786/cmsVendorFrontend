export function clearFileInputValue(
  input: HTMLInputElement | null | undefined,
): void {
  if (input) {
    input.value = '';
  }
}
