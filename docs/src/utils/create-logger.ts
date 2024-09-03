export function createLogger(output: HTMLUListElement) {
  return {
    log: (...args: any[]) => {
      output.innerHTML += `<li>${args
        .map((arg) => {
          try {
            return JSON.stringify(arg);
          } catch (err) {
            console.error(err);
            return '[JSON parse error]';
          }
        })
        .join(' ')}</li>`;

      while (output.children.length > 5) {
        output.removeChild(output.children[0]);
      }
    },
  };
}
