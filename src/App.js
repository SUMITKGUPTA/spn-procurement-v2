import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, push } from 'firebase/database';
import { Trash2, Plus } from 'lucide-react';

const firebaseConfig = {
  apiKey: 'AIzaSyC-N2qVnGC3VWy7MzC-UzVcxH6Pk7x8rKc',
  authDomain: 'spn-procurement-v2.firebaseapp.com',
  databaseURL: 'https://spn-procurement-v2-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'spn-procurement-v2',
  storageBucket: 'spn-procurement-v2.appspot.com',
  messagingSenderId: '828652631095',
  appId: '1:828652631095:web:6f23e4e1d1d2c7f5a8b9e0'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export default function App() {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState('');

  useEffect(() => {
    const itemsRef = ref(db, 'items');
    onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setItems(Object.entries(data).map(([key, value]) => ({ key, ...value })));
      } else {
        setItems([]);
      }
    });
  }, []);

  const addItem = () => {
    if (newItem.trim()) {
      push(ref(db, 'items'), { name: newItem, createdAt: new Date().toISOString() });
      setNewItem('');
    }
  };

  const deleteItem = (key) => {
    set(ref(db, `items/${key}`), null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8 text-center">SPN Procurement</h1>
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addItem()}
              placeholder="Add new item..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addItem}
              className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 font-semibold"
            >
              <Plus size={20} /> Add
            </button>
          </div>
        </div>
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.key}
              className="bg-white p-4 rounded-lg shadow flex justify-between items-center hover:shadow-md transition"
            >
              <span className="text-gray-800 font-medium">{item.name}</span>
              <button
                onClick={() => deleteItem(item.key)}
                className="text-red-500 hover:text-red-700 transition"
              >
                <Trash2 size={20} />
              </button>
            </li>
          ))}
        </ul>
        {items.length === 0 && (
          <p className="text-center text-gray-500 mt-8">No items yet. Add one to get started!</p>
        )}
      </div>
    </div>
  );
}
