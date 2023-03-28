// the API's URL
const apiURL = "https://01.gritlab.ax/api/graphql-engine/v1/graphql";

// my own userId in the grit:lab system
const ownID = 797;
const usernameQuery = `
        query {
            user(where: { id: { _eq: 797 }}) {
                login
            }
        }
    `;

const getLevelUpsQuery = `
query getLevelUps($userId: Int_comparison_exp){
    transaction(order_by: {amount:asc} , where:{ userId: $userId, type: {_eq:"level"}, createdAt:{ _gte: "2022-08-31"}}) {
        amount,
        createdAt,
        path
    }
}`;
const getLevelUpsVariables = { userId: { _eq: ownID } };

const getAllAuditsQuery = `
query getAuditRatio($offset: Int){
  transaction(limit: 50, offset: $offset, where: { userId: { _eq: 797}, createdAt: { _gte: "2022-08-28"} _and: {
    _or: [ { type: { _eq: "up" }}, { type: { _eq: "down" }}]
  }}) {
    type
    object {
      id
      name
      type
      childrenAttrs
    }
    amount
    createdAt
  }
}`;
const getAllAuditsVariables = { offset: 0 };

const allProjectsDoneQuery = `
query {
  progress(
    order_by: {createdAt: asc}
    where: {isDone: {_eq: true}, _and: [{userId: {_eq: 797}, grade: {_gte: 0.9}}, {object: {type: {_eq: "project"}}}]}
  ) {
    object {
      id
      name
    }
    updatedAt
  }
}`;

const userName = document.getElementById("name");
const infoField = document.getElementById("info");

let basicInfo = await buildBasicInfo();

// queryFetch is the basic function that does the GraphQL queries based on the input query and optional variables
async function queryFetch(query, variables) {
  return fetch(apiURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: query,
      variables: variables,
    }),
  }).then((res) => res.json());
}

// updating the name header
async function updateUsernameHeader() {
  return queryFetch(usernameQuery).then((data) => {
    userName.innerText = data.data.user[0].login + " : grit:lab stats";
  });
}

// getting the level progression during the main curriculum
async function getLevelProgression() {
  return queryFetch(getLevelUpsQuery, getLevelUpsVariables).then((data) => {
    let queryRegex = new RegExp("piscine-(js|go).");
    let list = data.data.transaction;
    list = list.filter((record) => !queryRegex.test(record.path));
    return list;
  });
}

async function buildBasicInfo() {
  // infoField.replaceChildren();
  let allLevels = await getLevelProgression();
  let highestLevel = allLevels[allLevels.length - 1];
  let auditRatio = await getAuditRatio();
  // infoField.innerText = `Current level: ${highestLevel.amount}
  //   Current audit ratio: ${auditRatio}`;
  return {
    highestLevel: highestLevel.amount,
    auditRatio: auditRatio,
  };
}

async function getAuditRatio(acc = undefined) {
  return queryFetch(getAllAuditsQuery, getAllAuditsVariables).then((data) => {
    let arr = data.data.transaction;
    let received = 0.0;
    let done = 0.0;
    for (let elem of arr) {
      if (elem.type === "up") {
        received += elem.amount;
      } else if (elem.type === "down") {
        done += elem.amount;
      }
    }
    if (acc === undefined) {
      acc = [received, done];
    } else {
      acc[0] += received;
      acc[1] += done;
    }
    if (data.data.transaction.length !== 50) {
      getAllAuditsVariables.offset = 0;
      return (acc[0] / acc[1]).toFixed(1);
    } else {
      getAllAuditsVariables.offset += 50;
      return getAuditRatio(acc);
    }
  });
}

const levelField = document.createElement("div");
levelField.id = "levelField";
let levels = await getLevelProgression();

async function levelsOverTime(levels) {
  levelField.replaceChildren();

  // Get the dimensions of the infoField element
  const infoFieldRect = infoField.getBoundingClientRect();

  // Define the margin
  const margin = { top: 20, right: 20, bottom: 50, left: 50 };

  // Calculate the dimensions of the graph
  const width = infoFieldRect.width - margin.left - margin.right;
  const height = infoFieldRect.height - margin.top - margin.bottom;

  // Create the SVG element for the graph
  const svg = d3
    .select("#levelField")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left}, ${margin.top})`);

  // set the dimensions and margins of the plot
  const formattedData = levels.map((item) => ({
    amount: item.amount,
    createdAt: new Date(item.createdAt),
  }));

  const timeFormatter = d3.timeFormat("%Y %B");

  // 3. Create the x and y scales
  const xScale = d3
    .scaleTime()
    .domain(d3.extent(formattedData, (d) => d.createdAt))
    .range([0, width]);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(formattedData, (d) => d.amount)])
    .range([height, 0]);

  // 4. Create the line generator
  const line = d3
    .line()
    .x((d) => xScale(d.createdAt))
    .y((d) => yScale(d.amount));

  // 5. Create SVG elements for the axes
  const xAxis = d3.axisBottom(xScale).tickFormat(timeFormatter).tickSize(0);
  const yAxis = d3.axisLeft(yScale);

  svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis);

  svg.append("g").call(yAxis);

  // 6. Create the path element for the line
  svg
    .append("path")
    .datum(formattedData)
    .attr("fill", "none")
    .attr("stroke", "#faf0e6")
    .attr("stroke-width", 1.5)
    .attr("d", line);

  // 7. Append the path element to the SVG element

  // 8. Add labels to the x and y axes
  svg
    .append("text")
    .attr("transform", `translate(${width / 2}, ${height + margin.top + 20})`)
    .style("text-anchor", "middle")
    .text("Time")
    .attr("fill", "#da7e05");

  svg
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left)
    .attr("x", 0 - height / 2)
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Levels")
    .attr("fill", "#da7e05");
}

const projectsField = document.createElement("div");
projectsField.id = "projectsField";

async function getAllProjectsDone() {
  projectsField.replaceChildren();
  let progress = await queryFetch(allProjectsDoneQuery);
  progress = progress.data.progress;
  // for (let [i, elem] of progress.data.progress) {
    for (let i = 0; i < progress.length; i++) {
    let query = `
    query {
      transaction(
        where: {objectId: {_eq: ${progress[i].object.id}}, userId: {_eq: 797}, type: {_eq: "xp"}}
      ) {
        type
        amount
        createdAt
        path
      }
    }
    `;
    await queryFetch(query).then((data) => {
      let largest = Math.max(...data.data.transaction.map((o) => o.amount));
      // console.log(data.data.transaction);
      progress[i].xp = largest;
      // progress[i].object.xp = largest;
    });
  }
  console.log("this", progress);

  infoField.appendChild(projectsField);
  let box = infoField.getBoundingClientRect();

  let margin = { top: 30, right: 30, bottom: 70, left: 60 },
    width = box.width - margin.left - margin.right,
    height = box.height - margin.top - margin.bottom;

  const svg = d3
    .select("#projectsField")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top, margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + 20 + ")");

  progress.sort(function (a, b) {
    return d3.ascending(new Date(a.updatedAt), new Date(b.updatedAt));
  });

  progress.forEach((e) => {
    e.updatedAt = new Date(e.updatedAt);
  });

  const xScale = d3
    .scaleBand()
    .domain(progress.map((d) => d.updatedAt))
    .range([0, width])
    .padding(0.4);

  const yScale = d3
    .scaleLinear()
    .domain([0, d3.max(progress, (d) => d.xp) + 10000])
    .range([height, 0]);

  const xAxis = d3.axisBottom(xScale).tickSize(0);
  let yAxis = d3.axisLeft(yScale);

  svg
    .append("g")
    .attr("transform", `translate(0,${height})`)
    // .attr('fill','white')
    // .attr('stroke','white')
    .attr("class", "x-axis")
    .call(xAxis);

  svg
    .append("g")
    // .attr('fill','white')
    .attr("class", "y-axis")
    .attr("stroke", "white")
    .call(yAxis);

  svg
    .select(".y-axis")
    .selectAll("text")
    .attr("y", -20) // move the labels up slightly
    .style("padding-right", "10px"); // add some padding to the right of the labels

  svg
    .selectAll("rect")
    .data(progress)
    .enter()
    .append("rect")
    .attr("x", (d) => xScale(d.updatedAt))
    .attr("y", (d) => {
      console.log("d", JSON.stringify(d));
      console.log("d.xp", d.xp);
      console.log("yScale", yScale(d.xp));
      return yScale(d.xp)})
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.xp))
    .attr("fill", "blueviolet")
    .attr("stroke", "blueviolet")
    .attr("id", "bar");

  console.log("that", progress[0]);

  svg
    .selectAll("rect")
    .append("div")
    .attr("id", "infotip")
    .text(
      (d) => `${d.xp / 1000}kB
${d.object.name}
${d.updatedAt.toLocaleDateString("fi-FI")}`
    );
}

const tooltip = document.createElement("div")
tooltip.id = "tooltip"
document.body.append(tooltip);
document.addEventListener("mouseover", (e) => {
  if (e.target.id === 'bar') {
    tooltip.style.display = "block";
    tooltip.style.left = `${e.clientX + 5}px`;
    tooltip.style.top = `${e.clientY - 25}px`;
    tooltip.textContent = e.target.firstChild.textContent;
  } else {
    tooltip.style.display = "none";
  }
});

let basicInfoElem = document.createElement("div");
basicInfoElem.id = "basicInfo";
basicInfoElem.innerText = `Current level: ${basicInfo.highestLevel}
Current audit ratio: ${basicInfo.auditRatio}`;

document.getElementById("home-screen").addEventListener("click", () => {
  infoField.replaceChildren(basicInfoElem);
});
document.getElementById("level-graph-button").addEventListener("click", () => {
  infoField.replaceChildren();
  infoField.append(levelField);
  levelsOverTime(levels);
});
document
  .getElementById("xp-by-project-button")
  .addEventListener("click", () => {
    infoField.replaceChildren();
    infoField.append(projectsField);
    getAllProjectsDone();
  });

let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    levelsOverTime(levels);
  }, 250);
});

updateUsernameHeader();
infoField.innerText = `Current level: ${basicInfo.highestLevel}
    Current audit ratio: ${basicInfo.auditRatio}`;
