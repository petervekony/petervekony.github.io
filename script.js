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

const getAllXPQuery = `
  query getAllXP($offset: Int){
  user(where: { id: { _eq: ${ownID} } }) {
    transactions(
      order_by: { createdAt: asc },
      offset: $offset,
      where: {
        type: { _eq: "xp" },
        _and: { path: { _regex: "school" } }
      }
    ) {
      createdAt
      amount
      path
      objectId
      object {
        name
      }
    }
  }
}`;
const getAllXPVariables = { offset: 0 };

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
    document.getElementById("loading").remove();
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
  let totalXP = await getAllXP().then((array) => addUpXP(array));
  // infoField.innerText = `Current level: ${highestLevel.amount}
  //   Current audit ratio: ${auditRatio}`;
  return {
    highestLevel: highestLevel.amount,
    auditRatio: auditRatio,
    totalXP: totalXP
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

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20 - margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("text-decoration", "underline")
    .attr("fill", "#da7e05")
    .text("Levels Over Time");
}

const projectsField = document.createElement("div");
projectsField.id = "projectsField";
let progress = await queryFetch(allProjectsDoneQuery).then(
  (data) => data.data.progress
);
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
  await queryFetch(query).then((d) => {
    let largest = Math.max(...d.data.transaction.map((o) => o.amount));
    progress[i].xp = largest;
  });
}

async function getAllProjectsDone(progress) {
  projectsField.replaceChildren();

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
    .attr("y", (d) => yScale(d.xp))
    .attr("width", xScale.bandwidth())
    .attr("height", (d) => height - yScale(d.xp))
    .attr("fill", "#da7e05")
    // .attr("stroke", "white")
    .attr("id", "bar");

  svg
    .selectAll("rect")
    .append("div")
    .attr("id", "infotip")
    .text(
      (d) => `${d.xp / 1000}kB
${d.object.name}
${d.updatedAt.toLocaleDateString("fi-FI")}`
    );

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", 20 - margin.top / 2)
    .attr("text-anchor", "middle")
    .style("font-size", "20px")
    .style("text-decoration", "underline")
    .attr("fill", "#da7e05")
    .text("Projects Done Over Time");
}

const tooltip = document.createElement("div");
tooltip.id = "tooltip";
document.body.append(tooltip);
document.addEventListener("mouseover", (e) => {
  if (e.target.id === "bar") {
    tooltip.style.display = "block";
    tooltip.style.left = `${e.clientX + 5}px`;
    tooltip.style.top = `${e.clientY - 25}px`;
    tooltip.textContent = e.target.firstChild.textContent;
  } else {
    tooltip.style.display = "none";
  }
});

async function getAllXP(array) {
  return queryFetch(getAllXPQuery, getAllXPVariables).then((data) => {
    data = data.data.user[0].transactions;

    if (array === undefined) {
      array = data;
    } else {
      array.push(...data);
    }

    if (data.length !== 50) {
      getAllXPVariables.offset = 0;
      return array;
    } else {
      getAllXPVariables.offset += 50;
      return getAllXP(array);
    }
  });
}

async function addUpXP(array) {
  let newObj = {};
  let total = 0;
  let queryRegex = new RegExp("piscine-(js|go)/");
  array = array.filter((record) => !queryRegex.test(record.path));
  for (let record of array) {
    let checkpoint = record.path.includes("checkpoint");
    let name = record.object.name;
    let notDone = name.includes("tetris-optimizer") || name.includes("ascii-art-reverse") || name.includes("groupie-tracker-visualizations");
    if (notDone) {
      continue;
    }
    if (!(name in newObj)) {
      newObj[name] = record.amount;
    } else if ((newObj[name]) && !checkpoint) {
      newObj[name] = Math.max(
              newObj[name],
              record.amount
            );
    } else {
      newObj[name] += record.amount
    }
  }

  for (let value of Object.values(newObj)) {
    total += value;
  }

  return Math.round(total / 1000);
}

let homeScreen = document.createElement("div");
homeScreen.id = "homeScreen";
homeScreen.innerText = `Name: Péter Vékony
Birthday: 20. 12. 1989
Nationality: Hungarian

Hi! I am an aspiring software developer. This site shows some of my stats in my school's, grit:lab's system.`;


let basicInfoElem = document.createElement("div");
let infoText = `Basic Info

Current level: ${basicInfo.highestLevel}
Current audit ratio: ${basicInfo.auditRatio}
Total XP earned: ${basicInfo.totalXP}kB`;
basicInfoElem.id = "basicInfo";
basicInfoElem.innerText = infoText;

document.getElementById("home-screen").addEventListener("click", () => {
  infoField.replaceChildren(homeScreen);
})
document.getElementById("basic-info").addEventListener("click", () => {
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
    getAllProjectsDone(progress);
  });

let resizeTimeout;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    levelsOverTime(levels);
    getAllProjectsDone(progress);
  }, 250);
});

updateUsernameHeader();
infoField.append(basicInfoElem);
