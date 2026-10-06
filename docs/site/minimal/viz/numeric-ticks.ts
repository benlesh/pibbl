import {
  linearTicks,
  niceLinearDomain,
  formatNumber,
  type LinearTickOptions,
  type NumberFormatOptions,
} from "@pibbl/core/viz";

const tickOptions: LinearTickOptions = { count: 5 };
const formatOptions: NumberFormatOptions = {
  maximumFractionDigits: 1,
  suffix: " °C",
};
const domain = niceLinearDomain([3.7, 27.4], tickOptions);
const heading = document.createElement("h2");
heading.textContent = "Prepare a readable temperature axis";
const explanation = document.createElement("p");
explanation.textContent = `Illustrative readings span 3.7–27.4 °C. Round the axis outward to ${domain[0]}–${domain[1]} °C, then choose evenly spaced ticks:`;
const output = document.createElement("p");
output.textContent = linearTicks(domain, tickOptions)
  .map((value) => formatNumber(value, formatOptions))
  .join(", ");
document.body.append(heading, explanation, output);
