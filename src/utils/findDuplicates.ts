const findDuplicates = (array: string[]): string[] => {
  let duplicates: string[] = [];
  let elementCount: { [element: string]: number } = {};

  for (let element of array) {
    if (elementCount[element]) {
      if (elementCount[element] === 1) {
        duplicates.push(element);
      }
      elementCount[element]++;
    } else {
      elementCount[element] = 1;
    }
  }

  return duplicates;
};

export default findDuplicates;
