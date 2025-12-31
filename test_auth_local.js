
// Run with: node test_auth_local.js

async function testAuth() {
    const baseUrl = 'http://localhost:10001/api/auth';

    console.log("---------------------------------------------------");
    console.log("TESTING TEACHER AUTHENTICATION (ESM)");
    console.log("---------------------------------------------------");

    // 1. REGISTER
    console.log("\n1. Testing Registration...");
    try {
        const regRes = await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: `teacher_${Date.now()}`,
                password: 'password123',
                fullName: 'Test Teacher',
                email: 'test@example.com'
            })
        });

        const regData = await regRes.json();
        console.log("Response:", regRes.status, regData);

        if (!regRes.ok && regData.error !== 'Tên đăng nhập đã tồn tại') {
            // throw new Error(regData.error || 'Registration failed');
            console.warn("Registration Warning:", regData.error);
        }
    } catch (e) {
        console.error("❌ Registration Error:", e.message);
    }

    // 2. LOGIN
    console.log("\n2. Testing Login...");
    try {
        // Try to login with the user we just created (or a known one)
        // We'll use a fixed one for stability in repeated runs if possible, but let's just try to login with the unique one we just made?
        // Actually, let's just try to register a specific user 'fixed_user' and login with it.

        const fixedUser = {
            username: 'fixed_teacher',
            password: 'password123',
            fullName: 'Fixed Teacher',
            email: 'fixed@example.com'
        };

        // Try register fixed user (might fail if exists, that's fine)
        await fetch(`${baseUrl}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fixedUser)
        });

        const loginRes = await fetch(`${baseUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: fixedUser.username,
                password: fixedUser.password
            })
        });

        const loginData = await loginRes.json();
        console.log("Login Response:", loginRes.status, loginData);

        if (loginData.success) {
            console.log("✅ TEST PASSED: Login successful!");
        } else {
            console.error("❌ TEST FAILED: Login failed.");
        }

    } catch (e) {
        console.error("❌ Login Error:", e.message);
    }
}

testAuth();
