function showXpTransactions(offset=0) {
    const query = `
        query {
            transaction(
                limit: 50,
                offset: ${offset},
                where: {
                    userId: { _eq: 797 },
                    type: { _eq: "xp"}
                }) {
                type,
                amount,
                objectId,
                userId,
                createdAt,
                path
            }
        }
    `;

    fetch("https://01.gritlab.ax/api/graphql-engine/v1/graphql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            query
        })
    }).then(response => {
        return response.json();
    }).then(data => {
        console.log(data)
        if ((data.data.transaction).length === 50) {
            showXpTransactions(offset + 50);
        }
    })
}

window.onload = showXpTransactions();