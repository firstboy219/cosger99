
export const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);

export const toCamelCase = (str: string) => str.replace(/([-_][a-z])/g, group => group.toUpperCase().replace('-', '').replace('_', ''));

export const convertKeysToSnakeCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToSnakeCase);
  
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = toSnakeCase(key);
      newObj[newKey] = convertKeysToSnakeCase(obj[key]);
    }
  }
  return newObj;
};

export const convertKeysToCamelCase = (obj: any): any => {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(convertKeysToCamelCase);
  
  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = toCamelCase(key);
      newObj[newKey] = convertKeysToCamelCase(obj[key]);
    }
  }
  return newObj;
};
