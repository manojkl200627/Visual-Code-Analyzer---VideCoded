const code = `class Student {
    constructor(id) {
        this.id = id;
    }
}
const s = new Student(1);`;
fetch('http://localhost:5000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', language: 'javascript', code })
}).then(res => res.json()).then(console.dir).catch(console.error);
