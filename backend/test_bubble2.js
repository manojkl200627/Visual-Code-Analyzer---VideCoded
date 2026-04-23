const code = `function bubbleSort(arr) {
    let array = [...arr];
    for (let i = 0; i < array.length - 1; i++) {
        for (let j = 0; j < array.length - i - 1; j++) {
            if (array[j] > array[j + 1]) {
                [array[j], array[j + 1]] = [array[j + 1], array[j]];
            }
        }
    }
    return array;
}
const arr = [8, 7, 6, 5, 4, 3, 2, 1];
const sortedArr = bubbleSort(arr);`;

fetch('http://localhost:5000/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test', language: 'javascript', code })
}).then(res => res.json()).then(data => {
    console.log(data);
}).catch(console.error);
