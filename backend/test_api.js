

async function test() {
    const code = `let x = 10;
log({ action: 'check', val: x });
let arr = [1, 2];
log({ action: 'compare', arr: [...arr] });`;

    const res = await fetch('http://127.0.0.1:5000/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test Log', language: 'javascript', code })
    });

    if (!res.ok) {
        const text = await res.text();
        console.error('Error:', res.status, text);
        return;
    }

    const data = await res.json();
    console.log('Success, steps:', data.steps.length);
    data.steps.forEach(s => {
        console.log(`Step ${s.stepIndex}: ${s.explanation}`);
    });
}

test();
