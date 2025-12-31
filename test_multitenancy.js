
// import fetch from 'node-fetch'; // Built-in in Node 18+


const baseUrl = 'http://localhost:10001/api';

async function testMultiTenancy() {
    console.log("---------------------------------------------------");
    console.log("TESTING MULTI-TENANCY A ISOLATION");
    console.log("---------------------------------------------------");

    // 1. Create Teacher A & B
    const userA = { username: `teacherA_${Date.now()}`, password: 'password', fullName: 'Teacher A', email: 'a@test.com' };
    const userB = { username: `teacherB_${Date.now()}`, password: 'password', fullName: 'Teacher B', email: 'b@test.com' };

    console.log(`Registering ${userA.username}...`);
    await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userA) });

    console.log(`Registering ${userB.username}...`);
    await fetch(`${baseUrl}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(userB) });

    // 2. Login
    const loginA = await (await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userA.username, password: userA.password }) })).json();
    const tokenA = loginA.token;
    console.log("Teacher A logged in.");

    const loginB = await (await fetch(`${baseUrl}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: userB.username, password: userB.password }) })).json();
    const tokenB = loginB.token;
    console.log("Teacher B logged in.");

    // 3. Teacher A creates Class A1
    console.log("Teacher A creating Class A1...");
    const classA1 = await (await fetch(`${baseUrl}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({ id: `ClassA_${Date.now()}`, name: 'Lớp 1A' })
    })).json();
    console.log("Created Class A:", classA1.id);

    // 4. Teacher B checks classes (Should be empty)
    console.log("Teacher B checking classes...");
    const classesB = await (await fetch(`${baseUrl}/classes`, {
        headers: { 'Authorization': `Bearer ${tokenB}` }
    })).json();

    if (classesB.find(c => c.id === classA1.id)) {
        console.error("❌ FAILURE: Teacher B can see Teacher A's class!");
    } else {
        console.log("✅ SUCCESS: Teacher B cannot see Teacher A's class.");
    }

    // 5. Teacher B creates Class B1
    console.log("Teacher B creating Class B1...");
    const classB1 = await (await fetch(`${baseUrl}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
        body: JSON.stringify({ id: `ClassB_${Date.now()}`, name: 'Lớp 1B' })
    })).json();
    console.log("Created Class B:", classB1.id);

    // 6. Teacher A checks classes (Should see A1, not B1)
    console.log("Teacher A checking classes...");
    const classesA = await (await fetch(`${baseUrl}/classes`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
    })).json();

    const hasA1 = classesA.find(c => c.id === classA1.id);
    const hasB1 = classesA.find(c => c.id === classB1.id);

    if (hasA1 && !hasB1) {
        console.log("✅ SUCCESS: Teacher A sees their class and NOT Teacher B's class.");
    } else {
        console.error("❌ FAILURE: Isolation check failed for Teacher A.");
        console.log("Seen:", classesA.map(c => c.id));
    }
}

testMultiTenancy();
