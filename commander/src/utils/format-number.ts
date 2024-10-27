/*
 * Locales code
 * https://gist.github.com/raushankrjha/d1c7e35cf87e69aa8b4208a8171a8416
 */

export type InputNumberValue = string | number | null | undefined;

export const WattUnits = ['W', 'KW', 'MW', 'GW', 'TW', 'PW', 'EW', 'ZW', 'YW'];
export const WattHoursUnits = ['', 'KWh', 'MWh', 'GWh', 'TWh', 'PWh', 'EWh', 'ZWh', 'YWh'];

type Options = (Intl.NumberFormatOptions | undefined) & {
  ensureConstantDecimals?: boolean;
  decimals?: number;
};

const DEFAULT_LOCALE = { code: 'en-US', currency: 'USD' };

function processInput(inputValue: InputNumberValue): number | null {
  if (inputValue == null || Number.isNaN(inputValue)) return null;
  return Number(inputValue);
}

// ----------------------------------------------------------------------

export function fNumber(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return '';

  const fm = (n: number): string => {
    if (options?.decimals === 0) {
      return Math.round(n).toString();
    }

    return new Intl.NumberFormat(locale.code, {
      maximumFractionDigits: options?.decimals || 2,
      minimumFractionDigits: options?.ensureConstantDecimals ? options?.decimals || 2 : 0,
      ...options,
    }).format(number);
  };

  return fm(number);
}

// ----------------------------------------------------------------------

export function fCurrency(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return '';

  const fm = (n: number): string => {
    if (options?.decimals === 0) {
      return Math.round(n).toString();
    }

    return new Intl.NumberFormat(locale.code, {
      style: 'currency',
      currency: locale.currency,
      maximumFractionDigits: options?.decimals || 2,
      minimumFractionDigits: options?.ensureConstantDecimals ? options?.decimals || 2 : 0,
      ...options,
    }).format(number);
  };

  return fm(number);
}

// ----------------------------------------------------------------------

export function fPercent(inputValue: InputNumberValue, options?: Options) {
  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return '';


  const fm = (n: number): string => {
    if (options?.decimals === 0) {
      return Math.round(n).toString();
    }

    return new Intl.NumberFormat(locale.code, {
      style: 'percent',
      maximumFractionDigits: options?.decimals || 2,
      minimumFractionDigits: options?.ensureConstantDecimals ? options?.decimals || 2 : 0,
      ...options,
    }).format(number / 100);
  };

  return fm(number);
}

// ----------------------------------------------------------------------

export function fShortenNumber(inputValue: number, units: string[], options?: Options) {
  let unitIndex = 0;
  // Scale the number down and increase the unit index until the value is less than 1000
  while (inputValue >= 1000 && unitIndex < units.length - 1) {
    inputValue /= 1000;
    unitIndex += 1;
  }

  const locale = DEFAULT_LOCALE;

  const number = processInput(inputValue);
  if (number === null) return '';

  const fm = (n: number): string => {
    if (options?.decimals === 0) {
      return Math.round(n).toString();
    }

    return new Intl.NumberFormat(locale.code, {
      notation: units.length ? undefined : 'compact',
      maximumFractionDigits: options?.decimals || 2,
      minimumFractionDigits: options?.ensureConstantDecimals ? options?.decimals || 2 : 0,
      ...options,
    }).format(number);
  };

  return (
    fm(inputValue).replace(/[A-Z]/g, (match) => match.toLowerCase()) +
    (units?.length ? ` ${units[unitIndex]}` : '')
  );
}

// ----------------------------------------------------------------------

export function fData(inputValue: InputNumberValue) {
  const number = processInput(inputValue);
  if (number === null || number === 0) return '0 bytes';

  const units = ['bytes', 'Kb', 'Mb', 'Gb', 'Tb', 'Pb', 'Eb', 'Zb', 'Yb'];
  const decimal = 2;
  const baseValue = 1024;

  const index = Math.floor(Math.log(number) / Math.log(baseValue));
  const fm = `${parseFloat((number / baseValue ** index).toFixed(decimal))} ${units[index]}`;

  return fm;
}
