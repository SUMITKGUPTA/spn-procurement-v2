import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ClipboardCheck, 
  Package, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Plus, 
  ArrowRight, 
  Edit2, 
  Save, 
  Truck, 
  FileText, 
  Download, 
  ArrowLeft, 
  Check, 
  Star, 
  Loader, 
  User, 
  UserCheck, 
  Upload, 
  Trash2,
  Info,
  Filter,
  Layers,
  Store,
  Tag,
  Camera,
  X
} from 'lucide-react';

// --- Firebase Standard Imports ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  getDocs
} from 'firebase/firestore';

const App = () => {
  // --- 1. State Management ---
  const [user, setUser] = useState(null);
  const [db, setDb] = useState(null);
  const [fbAppId, setFbAppId] = useState(typeof __app_id !== 'undefined' ? __app_id : 'spn-procure-v1');
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedUic, setSelectedUic] = useState(null);
  const [uicStatusFilter, setUicStatusFilter] = useState('All'); 
  const [minPartsFilter, setMinPartsFilter] = useState(0);
  const [maxPartsFilter, setMaxPartsFilter] = useState(25);

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [summaryEditingId, setSummaryEditingId] = useState(null);
  const [summaryEditForm, setSummaryEditForm] = useState({});

  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);
  const [generatedBy, setGeneratedBy] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [marketVendor, setMarketVendor] = useState(""); 

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalData, setModalData] = useState({ repairableCount: 0, spnAdded: 0, isDraft: false });

  // --- 2. Initial Auth & DB Setup ---
  useEffect(() => {
    const initFirebase = async () => {
      try {
        if (typeof __firebase_config !== 'undefined' && __firebase_config) {
          const config = JSON.parse(__firebase_config);
          const app = initializeApp(config);
          const auth = getAuth(app);
          const firestore = getFirestore(app);
          setDb(firestore);

          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }

          onAuthStateChanged(auth, (u) => {
            setUser(u);
            if (!u) setLoading(false);
          });
        } else {
          setLoading(false); 
        }
      } catch (err) {
        console.error("Init Error:", err);
        setLoading(false);
      }
    };
    initFirebase();
  }, []);

  // --- 3. Real-time Data Sync ---
  useEffect(() => {
    if (!user || !db) return;
    const q = collection(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docs.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      setRawData(docs);
      setLoading(false);
    }, (error) => {
      console.error("Sync error:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user, db, fbAppId]);

  // Load PDF Libraries
  useEffect(() => {
    const loadScript = (src) => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        document.body.appendChild(script);
      });
    };
    const initScripts = async () => {
      if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!window.jspdfAutotable) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js');
    };
    initScripts();
  }, []);

  // --- 4. Handlers ---
  const handleGlobalUpdate = async (spnCode, data) => {
    if (!db) return;
    const matches = rawData.filter(d => d.spnCode === spnCode);
    await Promise.all(matches.map(d => updateDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', d.id), data)));
  };

  const handleRowSave = async () => {
    if (!user || !db || !editingId) return;
    try {
      await updateDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', editingId), {
        status: String(editForm.status || 'Not Updated'),
        estPrice: Number(editForm.estPrice || 0),
        vendor: String(editForm.vendor || '')
      });
      setEditingId(null);
    } catch (e) { console.error(e); }
  };

  const handleVendorChange = async (id, value) => {
    if (!user || !db) return;
    const item = rawData.find(d => d.id === id);
    if (!item) return;
    const matchingDocs = rawData.filter(d => d.spnCode === item.spnCode);
    await Promise.all(matchingDocs.map(d => 
      updateDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', d.id), { vendor: String(value) })
    ));
  };

  const handleSummarySave = async () => {
    if (!user || !db) return;
    const itemsToUpdate = rawData.filter(item => String(item.spnCode) === String(summaryEditForm.spnCode));
    try {
      await Promise.all(itemsToUpdate.map(item => 
        updateDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', item.id), {
          estPrice: Number(summaryEditForm.estPrice || 0),
          vendor: String(summaryEditForm.vendor || ''),
          status: String(summaryEditForm.status || 'Not Updated')
        })
      ));
      setSummaryEditingId(null);
    } catch (e) { console.error(e); }
  };

  const handleCsvUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!user || !db) {
      alert('Firebase is still initializing. Please wait a moment and try again.');
      return;
    }    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      const rows = text.split(/\r\n|\n/);
      const parseCSVLine = (line) => {
        const result = [];
        let cur = '', inQuote = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') inQuote = !inQuote;
          else if (char === ',' && !inQuote) {
            result.push(cur.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            cur = '';
          } else cur += char;
        }
        result.push(cur.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
        return result;
      };
      try {
        const snapshot = await getDocs(collection(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests'));
        await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', d.id))));
        const promises = [];
        for (let i = 0; i < rows.length; i++) {
          const rowText = rows[i];
          if (!rowText.trim()) continue;
          const cols = parseCSVLine(rowText);
          if (cols[0] && (cols[0].trim().toUpperCase() === 'ID' || cols[0].trim().toUpperCase() === 'UIC')) continue;
          if (cols.length >= 5) {
            let rawStatus = cols[9] ? cols[9].trim() : 'Not Updated';
            if (rawStatus.toLowerCase() === 'available') rawStatus = 'Available';
            const qtyStr = cols[5] ? cols[5].trim() : "";
            const parsedQty = qtyStr === "" ? 0 : Number(qtyStr);
            promises.push(addDoc(collection(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests'), {
              uic: String(cols[0] || ''),
              brand: String(cols[1] || ''),
              model: String(cols[2] || ''), 
              spnCode: String(cols[3] || ''),
              spnName: String(cols[4] || ''), 
              reqQty: isNaN(parsedQty) ? 0 : parsedQty,
              estPrice: parseFloat(cols[6]) || 0,
              finalPrice: cols[7] || '',
              vendor: String(cols[8] || ''),
              status: rawStatus,
              remark: String(cols[10] || ''),
              createdAt: new Date().toISOString()
            }));
          }
        }
        await Promise.all(promises);
      } catch (err) { console.error(err); } finally {
        setIsImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const clearDatabase = async () => {
    if(!user || !db || !confirm('Reset database?')) return;
    setLoading(true);
    const snapshot = await getDocs(collection(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests'));
    await Promise.all(snapshot.docs.map(d => deleteDoc(doc(db, 'artifacts', fbAppId, 'public', 'data', 'spn_requests', d.id))));
    setLoading(false);
  };

  // --- 5. Computations ---
  const getRequestId = (index) => {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const i = index % (26 * 26 * 26);
    const char3 = letters[i % 26];
    const char2 = letters[Math.floor(i / 26) % 26];
    const char1 = letters[Math.floor(i / (26 * 26)) % 26];
    const num = String(index + 1).padStart(3, '0');
    return `${char1}${char2}${char3}${num}`;
  };

  const uicStatusMap = useMemo(() => {
    const map = {};
    const uics = [...new Set(rawData.map(d => d.uic).filter(Boolean))];
    uics.forEach(uic => {
      const parts = rawData.filter(d => d.uic === uic);
      if (parts.length === 0) {
        map[uic] = 'gray';
      } else {
        const allAvl = parts.every(p => (Number(p.reqQty) || 0) === 0 || p.status === 'Available');
        const allMissing = parts.every(p => (Number(p.reqQty) || 0) > 0 && p.status !== 'Available');
        if (allAvl) map[uic] = 'green';
        else if (allMissing) map[uic] = 'red';
        else map[uic] = 'blue'; 
      }
    });
    return map;
  }, [rawData]);

  const uniqueUicList = useMemo(() => {
    return Object.keys(uicStatusMap).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  }, [uicStatusMap]);

  const uicPartCounts = useMemo(() => {
    const counts = {};
    rawData.forEach(d => { if (d.uic) counts[String(d.uic)] = (counts[String(d.uic)] || 0) + 1; });
    return counts;
  }, [rawData]);

  const summaryData = useMemo(() => {
    const groups = {};
    rawData.forEach(row => {
      if (!row.spnCode) return;
      const code = String(row.spnCode);
      if (!groups[code]) {
        groups[code] = {
          id: code, brand: String(row.brand), model: String(row.model),
          spnCode: code, spnName: String(row.spnName), reqQty: 0, availableQty: 0,
          estPrice: Number(row.estPrice) || 0, vendor: String(row.vendor), status: String(row.status), 
          uniqueStatus: new Set()
        };
      }
      const val = Number(row.reqQty) || 0;
      groups[code].reqQty += val;
      groups[code].availableQty += (val === 0 ? 1 : 0);
      groups[code].uniqueStatus.add(String(row.status || 'Not Updated'));
    });

    return Object.values(groups).map(g => {
      const statusList = Array.from(g.uniqueStatus);
      let finalStatus = statusList.length === 1 ? statusList[0] : 'Not Updated';
      if (statusList.length > 1) {
        if (g.availableQty > 0 && g.reqQty > 0) finalStatus = 'Partially Available';
        else if (g.availableQty > 0 && g.reqQty === 0) finalStatus = 'Available';
        else if (g.reqQty > 0 && g.availableQty === 0) finalStatus = 'Not Available';
      }
      return { ...g, status: finalStatus };
    });
  }, [rawData]);

  const cameraSummaryData = useMemo(() => {
    return summaryData.filter(item => 
      String(item.spnName).toLowerCase().includes('camera')
    );
  }, [summaryData]);

  const cameraUicData = useMemo(() => {
    const uicsWithCamera = new Set(
      rawData
        .filter(item => String(item.spnName).toLowerCase().includes('camera'))
        .map(item => String(item.uic))
    );
    return rawData
      .filter(item => uicsWithCamera.has(String(item.uic)))
      .sort((a, b) => {
        const uicA = String(a.uic || '');
        const uicB = String(b.uic || '');
        const uicDiff = uicA.localeCompare(uicB, undefined, { numeric: true });
        if (uicDiff !== 0) return uicDiff;
        const isCameraA = String(a.spnName || '').toLowerCase().includes('camera');
        const isCameraB = String(b.spnName || '').toLowerCase().includes('camera');
        if (isCameraA && !isCameraB) return -1;
        if (!isCameraA && isCameraB) return 1;
        return String(a.spnCode || '').localeCompare(String(b.spnCode || ''));
      });
  }, [rawData]);

  const pickupRequestGroups = useMemo(() => {
    const groups = {};
    cameraUicData.forEach(item => {
      const uicStr = String(item.uic);
      if (!groups[uicStr]) {
        groups[uicStr] = {
          uic: uicStr,
          brand: String(item.brand),
          model: String(item.model),
          parts: []
        };
      }
      groups[uicStr].parts.push({
        spnName: String(item.spnName),
        reqQty: Number(item.reqQty),
        status: String(item.status),
        vendor: String(item.vendor)
      });
    });
    return Object.values(groups).sort((a, b) => a.uic.localeCompare(b.uic, undefined, { numeric: true }));
  }, [cameraUicData]);

  const stats = useMemo(() => {
    const totalModels = uniqueUicList.length;
    const ready = uniqueUicList.filter(u => uicStatusMap[u] === 'green').length;
    const partial = uniqueUicList.filter(u => uicStatusMap[u] === 'blue').length;
    const notReady = totalModels - ready - partial;
    const parts = rawData.reduce((acc, curr) => acc + (Number(curr.reqQty) || 0), 0);
    return { totalModels, ready, partial, notReady, parts };
  }, [uniqueUicList, uicStatusMap, rawData]);

  const filteredUicData = useMemo(() => {
    let base = rawData;
    if (selectedUic) return base.filter(d => String(d.uic) === String(selectedUic));
    if (uicStatusFilter !== 'All') {
      const color = uicStatusFilter === 'Ready' ? 'green' : uicStatusFilter === 'Partial' ? 'blue' : 'red';
      base = base.filter(d => uicStatusMap[String(d.uic)] === color);
    }
    return base.filter(d => {
      const count = uicPartCounts[String(d.uic)] || 0;
      return count >= minPartsFilter && count <= maxPartsFilter;
    });
  }, [rawData, selectedUic, uicStatusFilter, minPartsFilter, maxPartsFilter, uicStatusMap, uicPartCounts]);

  const vendorGroupedData = useMemo(() => {
    const readyUics = uniqueUicList.filter(uic => uicStatusMap[uic] === 'green');
    const sourceData = readyUics.length > 0 ? rawData.filter(d => readyUics.includes(String(d.uic))) : [];
    
    const vGroups = {};
    sourceData.filter(item => (Number(item.reqQty) || 0) > 0).forEach(item => {
      const vName = String(item.vendor || 'Unknown Vendor');
      if (!vGroups[vName]) vGroups[vName] = { vendorName: vName, parts: {} };
      const code = String(item.spnCode);
      const partsMap = vGroups[vName].parts;
      if (!partsMap[code]) {
        partsMap[code] = {
          spnCode: code, spnName: String(item.spnName), brand: String(item.brand), model: String(item.model),
          estPrice: Number(item.estPrice) || 0, finalPrice: item.finalPrice || '', totalQty: 0, uics: []
        };
      }
      partsMap[code].totalQty += (Number(item.reqQty) || 0);
      if (!partsMap[code].uics.includes(String(item.uic))) partsMap[code].uics.push(String(item.uic));
    });

    return Object.values(vGroups).sort((a,b) => a.vendorName.localeCompare(b.vendorName)).map((v, idx) => ({
      ...v, requestId: getRequestId(idx), partList: Object.values(v.parts), date: new Date().toLocaleDateString()
    }));
  }, [uniqueUicList, uicStatusMap, rawData]);

  // --- PDF Functions ---
  const downloadPickupPdf = () => {
    const lib = window.jspdf?.jsPDF;
    if (!lib) return;
    setIsPdfGenerating(true);
    setTimeout(() => {
      try {
        const pdfDoc = new lib({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        pdfDoc.setFontSize(18); pdfDoc.setTextColor(40, 44, 52); pdfDoc.text("UNIT PICKUP REQUEST - MARKET REPAIR", 15, 15);
        pdfDoc.setFontSize(9); pdfDoc.setTextColor(100, 116, 139);
        pdfDoc.text(`Generated By: ${generatedBy || 'N/A'}`, 15, 22);
        pdfDoc.text(`Market Vendor: ${marketVendor || 'N/A'}`, 15, 27);
        pdfDoc.text(`Date: ${new Date().toLocaleDateString()}`, 282, 15, { align: 'right' });
        pdfDoc.text(`Total Units: ${pickupRequestGroups.length}`, 15, 32);

        const tableBody = pickupRequestGroups.map((group, i) => {
           const partsLines = group.parts.map(p => {
             const isBackCam = p.spnName.toLowerCase().includes('back camera');
             const prefix = isBackCam ? '>>> ' : '• ';
             const name = isBackCam ? p.spnName.toUpperCase() : p.spnName;
             return `${prefix}${name} (Qty: ${p.reqQty}) - [${p.status}]`;
           });
           return [i + 1, group.uic, `${group.brand}\n${group.model}`, partsLines.join('\n'), ""];
        });

        pdfDoc.autoTable({ 
          startY: 40, head: [['#', 'UIC REF', 'MODEL DETAILS', 'PARTS DETAILS & STATUS', 'RECEIVER SIGNATURE']], body: tableBody,
          theme: 'grid', headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: 'bold', halign: 'center', cellPadding: 3 },
          styles: { fontSize: 7, cellPadding: 2, valign: 'top', overflow: 'linebreak', lineColor: [200, 200, 200] },
          columnStyles: { 0: { halign: 'center', cellWidth: 10 }, 1: { cellWidth: 32 }, 2: { cellWidth: 32 }, 3: { cellWidth: 'auto' }, 4: { cellWidth: 35 } },
          margin: { left: 15, right: 15 },
          tableWidth: 'auto'
        });

        pdfDoc.save(`Market_Pickup_Request_${Date.now()}.pdf`);
      } catch (err) { console.error(err); } finally { setIsPdfGenerating(false); }
    }, 500);
  };

  const downloadPdf = () => {
    const lib = window.jspdf?.jsPDF;
    if (!lib) return;
    setIsPdfGenerating(true);
    setTimeout(() => {
      try {
        const pdfDoc = new lib({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        vendorGroupedData.forEach((group, idx) => {
          if (idx > 0) pdfDoc.addPage();
          pdfDoc.setFontSize(18); pdfDoc.text("PURCHASE REQUEST ORDER", 15, 15);
          pdfDoc.setFontSize(10);
          pdfDoc.text(`Request ID: ${group.requestId}`, 15, 22);
          pdfDoc.text(`Vendor: ${group.vendorName}`, 15, 27);
          pdfDoc.text(`Generated By: ${generatedBy || 'User'}`, 15, 32);
          pdfDoc.text(`Date: ${group.date}`, 282, 15, { align: 'right' });
          const table = group.partList.map((p, i) => [
            i + 1, `${p.spnName}\nCode: ${p.spnCode}\nIDs: ${p.uics.join(', ')}`,
            p.totalQty, `Rs. ${p.estPrice}`, p.finalPrice ? `Rs. ${p.finalPrice}` : '____',
            `Rs. ${((parseFloat(p.finalPrice)||p.estPrice)*p.totalQty).toLocaleString()}`
          ]);
          pdfDoc.autoTable({ startY: 40, head: [['#', 'Part Details', 'Qty', 'Est. Price', 'Purchase Price', 'Total']], body: table, margin: { left: 15, right: 15 }, columnStyles: { 1: { cellWidth: 110 } } });
        });
        pdfDoc.save(`SPN_Orders_${Date.now()}.pdf`);
      } catch (err) { console.error(err); } finally { setIsPdfGenerating(false); }
    }, 500);
  };

  const processPurchasePlan = () => {
    const isDraft = stats.ready === 0;
    const count = vendorGroupedData.reduce((acc, curr) => acc + curr.partList.length, 0);
    setModalData({ repairableCount: Number(stats.ready), spnAdded: count, isDraft });
    setShowConfirmModal(true);
  };

  const getStatusColor = (s) => {
    if (s === 'Available') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (s === 'Partially Available') return 'bg-blue-100 text-blue-800 border-blue-200';
    if (s === 'Not Available') return 'bg-rose-100 text-rose-800 border-rose-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  const getStatusBadge = (s, size = 'normal') => {
    const colorClass = getStatusColor(s);
    const textSize = size === 'small' ? 'text-[8px]' : 'text-[9px]';
    return <span className={`px-2 py-0.5 rounded-full ${textSize} font-black uppercase border ${colorClass}`}>{String(s)}</span>;
  };

  const StatCard = ({ label, value, Icon, color }) => (
    <div className={`bg-white p-4 rounded-3xl border-l-4 ${color} shadow-sm flex justify-between items-center hover:translate-y-[-2px] transition-all`}>
      <div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{String(label)}</div><div className="text-2xl font-black text-slate-900 tracking-tighter">{String(value)}</div></div>
      <div className="p-3 bg-slate-50 rounded-2xl"><Icon size={20} className="text-slate-400"/></div>
    </div>
  );

  // --- Main Views ---
  const renderDashboardView = () => (
    <div className="animate-in fade-in duration-500">
      <header className="bg-white border-b sticky top-0 z-30 shadow-sm px-8 py-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-6 h-6 text-indigo-600" /> SPN Planning</h1>
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} className="hidden" onChange={handleCsvUpload}/>
          <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center px-4 py-2 border rounded-lg text-sm bg-white font-semibold shadow-sm hover:bg-slate-50 transition-all"><Upload className="w-4 h-4 mr-2" /> CSV Upload</button>
          <button onClick={clearDatabase} className="inline-flex items-center px-4 py-2 border border-rose-200 text-rose-700 rounded-lg text-sm bg-white font-semibold shadow-sm hover:bg-rose-50 transition-all"><Trash2 className="w-4 h-4 mr-2" /> Reset DB</button>
          <button onClick={() => setCurrentPage('summary')} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold shadow-md hover:bg-indigo-700 transition-all"><FileText className="w-4 h-4 mr-2" /> View Purchase Plan</button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-8 py-6 grid grid-cols-1 md:grid-cols-5 gap-3">
        <StatCard label="Total Units" value={stats.totalModels} Icon={Package} color="border-slate-500" />
        <StatCard label="Ready Units" value={stats.ready} Icon={CheckCircle} color="border-emerald-500" />
        <StatCard label="Partially Ready" value={stats.partial} Icon={Info} color="border-blue-500" />
        <StatCard label="Not Ready" value={stats.notReady} Icon={XCircle} color="border-rose-500" />
        <StatCard label="Missing Parts" value={stats.parts} Icon={ClipboardCheck} color="border-indigo-500" />
      </div>

      <main className="max-w-7xl mx-auto px-8 pb-32 space-y-12">
        {loading ? <div className="text-center py-20"><Loader className="w-10 h-10 animate-spin mx-auto text-indigo-600"/></div> : (
          <>
            {/* Table 1: Camera Parts Summary */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-indigo-50 font-bold flex justify-between items-center text-indigo-900">
                <div className="flex items-center gap-2"><Camera size={18} className="text-indigo-600"/> Camera Parts Summary</div>
                <button onClick={() => setCurrentPage('pickup_request')} className="text-[10px] font-bold bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg shadow-sm hover:bg-indigo-50 transition-all flex items-center gap-2">
                  <Store size={12}/> Create Unit Pickup Request for Market
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 uppercase text-[10px] font-black tracking-widest text-slate-400 border-b">
                    <tr><th className="p-4">#</th><th>Brand/Model</th><th>SPN Details</th><th className="text-center">Req. Qty</th><th className="text-center">Available Qty</th><th>Est. Price</th><th>Vendor</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {cameraSummaryData.length === 0 ? (
                      <tr><td colSpan="9" className="p-8 text-center text-slate-400 italic">No camera parts found.</td></tr>
                    ) : cameraSummaryData.map((spn, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-300">{idx + 1}</td>
                        <td><div className="font-bold text-slate-900">{spn.brand}</div><div className="text-xs text-slate-500">{spn.model}</div></td>
                        <td><div className="text-xs text-blue-600 font-mono font-bold">{spn.spnCode}</div><div className="max-w-xs truncate text-slate-700 font-medium">{spn.spnName}</div></td>
                        <td className="text-center font-bold text-slate-600">{spn.reqQty}</td>
                        <td className="text-center font-bold text-emerald-600">{spn.availableQty}</td>
                        <td>{summaryEditingId === spn.id ? <input type="number" className="w-20 border rounded px-1" value={summaryEditForm.estPrice} onChange={e=>setSummaryEditForm({...summaryEditForm, estPrice: e.target.value})}/> : `₹${spn.estPrice}`}</td>
                        <td>{summaryEditingId === spn.id ? <input className="w-24 border rounded px-1" value={summaryEditForm.vendor} onChange={e=>setSummaryEditForm({...summaryEditForm, vendor: e.target.value})}/> : (spn.vendor || '-')}</td>
                        <td>{summaryEditingId === spn.id ? <select className="text-xs border rounded p-1" value={summaryEditForm.status} onChange={e=>setSummaryEditForm({...summaryEditForm, status: e.target.value})}><option>Available</option><option>Partially Available</option><option>Not Available</option><option>Not Updated</option></select> : getStatusBadge(spn.status)}</td>
                        <td>{summaryEditingId === spn.id ? <button onClick={handleSummarySave} className="p-1.5 bg-emerald-600 text-white rounded shadow-sm hover:bg-emerald-700 transition-colors"><Save size={14}/></button> : <button onClick={() => { setSummaryEditingId(spn.id); setSummaryEditForm({...spn}); }} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={14}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Table 2: Summary of SPN (Aggregated) */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b bg-slate-50 font-bold flex justify-between items-center">
                <span className="text-slate-700">Summary of SPN (Aggregated)</span>
                <span className="text-[10px] text-slate-400 font-normal uppercase tracking-widest">Updates here apply to all linked UICs</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 uppercase text-[10px] font-black tracking-widest text-slate-400 border-b">
                    <tr><th className="p-4">#</th><th>Brand/Model</th><th>SPN Details</th><th className="text-center">Req. Qty</th><th className="text-center">Available Qty</th><th>Est. Price</th><th>Vendor</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {summaryData.map((spn, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-300">{idx + 1}</td>
                        <td><div className="font-bold text-slate-900">{spn.brand}</div><div className="text-xs text-slate-500">{spn.model}</div></td>
                        <td><div className="text-xs text-blue-600 font-mono font-bold">{spn.spnCode}</div><div className="max-w-xs truncate text-slate-700 font-medium">{spn.spnName}</div></td>
                        <td className="text-center font-bold text-slate-600">{spn.reqQty}</td>
                        <td className="text-center font-bold text-emerald-600">{spn.availableQty}</td>
                        <td>{summaryEditingId === spn.id ? <input type="number" className="w-20 border rounded px-1" value={summaryEditForm.estPrice} onChange={e=>setSummaryEditForm({...summaryEditForm, estPrice: e.target.value})}/> : `₹${spn.estPrice}`}</td>
                        <td>{summaryEditingId === spn.id ? <input className="w-24 border rounded px-1" value={summaryEditForm.vendor} onChange={e=>setSummaryEditForm({...summaryEditForm, vendor: e.target.value})}/> : (spn.vendor || '-')}</td>
                        <td>{summaryEditingId === spn.id ? <select className="text-xs border rounded p-1" value={summaryEditForm.status} onChange={e=>setSummaryEditForm({...summaryEditForm, status: e.target.value})}><option>Available</option><option>Partially Available</option><option>Not Available</option><option>Not Updated</option></select> : getStatusBadge(spn.status)}</td>
                        <td>{summaryEditingId === spn.id ? (
                          <div className="flex gap-1">
                            <button onClick={handleSummarySave} className="p-1.5 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700"><Save size={14}/></button>
                            <button onClick={() => setSummaryEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded shadow-sm"><X size={14}/></button>
                          </div>
                        ) : <button onClick={() => { setSummaryEditingId(spn.id); setSummaryEditForm({...spn}); }} className="p-1.5 text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Table 3: Data of SPN Purchase UIC-wise */}
            <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-6 border-b bg-slate-50 space-y-6">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-slate-700 flex items-center gap-2">
                    <Truck size={18} className="text-amber-500"/> Data of SPN Purchase UIC-wise
                  </div>
                  <div className="flex bg-white border rounded-lg p-1 shadow-sm">
                    <button onClick={() => setUicStatusFilter('All')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uicStatusFilter === 'All' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500'}`}>All</button>
                    <button onClick={() => setUicStatusFilter('Ready')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uicStatusFilter === 'Ready' ? 'bg-emerald-600 text-white shadow-md' : 'text-emerald-600'}`}>Ready</button>
                    <button onClick={() => setUicStatusFilter('Partial')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uicStatusFilter === 'Partial' ? 'bg-blue-600 text-white shadow-md' : 'text-blue-600'}`}>Partial</button>
                    <button onClick={() => setUicStatusFilter('Not Ready')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${uicStatusFilter === 'Not Ready' ? 'bg-rose-600 text-white shadow-md' : 'text-rose-600'}`}>Not Ready</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Layers size={12}/> Parts Count Range</label>
                    <div className="flex items-center gap-4">
                      <input type="range" min="0" max="25" value={minPartsFilter} onChange={(e) => setMinPartsFilter(parseInt(e.target.value))} className="flex-1 accent-indigo-600"/>
                      <input type="range" min="0" max="25" value={maxPartsFilter} onChange={(e) => setMaxPartsFilter(parseInt(e.target.value))} className="flex-1 accent-indigo-600"/>
                      <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap bg-slate-100 px-2 py-1 rounded">{minPartsFilter} - {maxPartsFilter} Parts</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Filter size={12}/> IDs List</label>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      <button onClick={()=>setSelectedUic(null)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${!selectedUic ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-500'}`}>Reset</button>
                      {uniqueUicList.map(u => {
                        const uicColor = uicStatusMap[u]; const partsCount = uicPartCounts[u] || 0;
                        const matchStatus = uicStatusFilter === 'All' || (uicStatusFilter === 'Ready' && uicColor === 'green') || (uicStatusFilter === 'Partial' && uicColor === 'blue') || (uicStatusFilter === 'Not Ready' && uicColor === 'red');
                        if (!matchStatus || partsCount < minPartsFilter || partsCount > maxPartsFilter) return null;
                        return (<button key={u} onClick={()=>setSelectedUic(u)} className={`px-3 py-1 rounded-full text-[10px] font-bold border transition-all flex items-center gap-2 whitespace-nowrap ${selectedUic === u ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 hover:border-indigo-200'}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${uicColor === 'green' ? 'bg-emerald-500' : uicColor === 'blue' ? 'bg-blue-500' : 'bg-rose-500'}`} />
                          {u} <span className="text-[8px] font-medium opacity-50">{partsCount}</span>
                        </button>);
                      })}
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 uppercase text-[10px] font-black tracking-widest text-slate-400 border-b">
                    <tr><th className="p-4">#</th><th>UIC Ref</th><th>Model Details</th><th>Part Details</th><th className="text-center">Req. Qty</th><th className="text-center">Avl. Qty</th><th className="text-right">Price</th><th className="text-center">Vendor</th><th className="text-center">Status</th><th>Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredUicData.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold text-slate-300 text-xs">{idx + 1}</td>
                        <td className="py-4 font-mono text-xs font-black text-slate-900">{item.uic}</td>
                        <td><div className="text-xs font-bold text-slate-800">{item.brand}</div><div className="text-[10px] text-slate-500">{item.model}</div></td>
                        <td><div className="text-[10px] font-bold text-slate-500">{item.spnCode}</div><div className="text-xs text-slate-700">{item.spnName}</div></td>
                        <td className="text-center font-bold text-slate-600">{item.reqQty}</td>
                        <td className="text-center font-bold text-emerald-600">{(Number(item.reqQty) === 0 ? 1 : 0)}</td>
                        <td className="text-right font-black text-slate-900">{editingId === item.id ? <input type="number" className="w-20 border rounded px-1 text-right" value={editForm.estPrice} onChange={e=>setEditForm({...editForm, estPrice: e.target.value})}/> : `₹${item.estPrice}`}</td>
                        <td className="text-center"><input type="text" className="w-24 text-[10px] border rounded px-2 py-1 outline-none transition-all focus:ring-1 focus:ring-indigo-200" value={editingId === item.id ? (editForm.vendor || '') : (item.vendor || '')} onChange={(e) => editingId === item.id ? setEditForm({...editForm, vendor: e.target.value}) : handleVendorChange(item.id, e.target.value)} /></td>
                        <td className="text-center">{editingId === item.id ? <select className="text-xs border rounded p-1" value={editForm.status} onChange={e=>setEditForm({...editForm, status: e.target.value})}><option>Available</option><option>Partially Available</option><option>Not Available</option><option>Not Updated</option></select> : getStatusBadge(item.status)}</td>
                        <td className="p-4">{editingId === item.id ? (
                          <div className="flex gap-1">
                            <button onClick={handleRowSave} className="p-1.5 bg-indigo-600 text-white rounded shadow-sm hover:bg-indigo-700"><Save size={14}/></button>
                            <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded shadow-sm"><X size={14}/></button>
                          </div>
                        ) : <button onClick={() => { setEditingId(item.id); setEditForm({...item}); }} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 size={14}/></button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="fixed bottom-0 w-full bg-white/90 backdrop-blur-md border-t p-6 flex flex-col md:flex-row items-center justify-center gap-4 shadow-2xl z-40">
         <div className="text-xs text-slate-400 font-medium"><AlertCircle size={14} className="inline mr-1 text-amber-500"/> Plan strictly includes only <span className="text-emerald-600 font-bold">Ready</span> units.</div>
         <button onClick={processPurchasePlan} disabled={rawData.length===0} className="bg-indigo-600 text-white px-16 py-3.5 rounded-2xl font-black text-sm tracking-widest hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-100 transition-all">PROCESS PURCHASE PLAN</button>
      </footer>
    </div>
  );

  const renderPickupRequestView = () => (
    <div className="min-h-screen bg-slate-50 pb-20 animate-in slide-in-from-bottom duration-300">
      <header className="bg-white border-b px-8 py-6 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentPage('dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><ArrowLeft size={24}/></button>
          <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">Market Pickup Request</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">For Camera Related Units</p></div>
        </div>
        <button onClick={downloadPickupPdf} disabled={isPdfGenerating} className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 shadow-lg transition-all active:scale-95">
          {isPdfGenerating ? <Loader className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} DOWNLOAD PDF
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-8 mt-8 space-y-8 pb-12">
        <div className="bg-white p-8 rounded-3xl shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><User size={12}/> Generated By</label>
            <input type="text" value={generatedBy} onChange={e=>setGeneratedBy(e.target.value)} placeholder="Enter name..." className="w-full px-4 py-3 border rounded-2xl text-sm outline-none font-medium transition-all focus:ring-2 focus:ring-indigo-100"/>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Store size={12}/> Market Vendor / Service Center</label>
            <input type="text" value={marketVendor} onChange={e=>setMarketVendor(e.target.value)} placeholder="Enter vendor name..." className="w-full px-4 py-3 border rounded-2xl text-sm outline-none font-medium transition-all focus:ring-2 focus:ring-indigo-100"/>
          </div>
        </div>

        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-8 py-6 border-b bg-slate-50 flex justify-between items-center">
             <div className="font-bold text-slate-700 flex items-center gap-2">Units for Pickup <span className="bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs">{pickupRequestGroups.length}</span></div>
             <div className="text-xs text-slate-400 font-medium">Grouped by UIC Ref | Sorted by Camera priority</div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white uppercase text-[10px] font-black tracking-widest text-slate-400 border-b">
                <tr><th className="p-5 w-16 text-center">#</th><th>UIC Ref & Model</th><th>Parts Details & Availability</th><th>Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pickupRequestGroups.length === 0 ? (
                  <tr><td colSpan="4" className="p-10 text-center text-slate-400 italic">No camera-related units found.</td></tr>
                ) : pickupRequestGroups.map((group, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 text-center font-bold text-slate-300">{idx + 1}</td>
                    <td className="p-5 align-top">
                      <div className="font-mono text-sm font-black text-slate-900">{group.uic}</div>
                      <div className="text-xs font-bold text-slate-600 mt-1">{group.brand}</div>
                      <div className="text-[10px] text-slate-400">{group.model}</div>
                    </td>
                    <td className="p-5">
                      <div className="space-y-1.5">
                        {group.parts.map((p, pIdx) => {
                          const isBackCamera = p.spnName.toLowerCase().includes('back camera');
                          return (
                            <div key={pIdx} className={`flex items-center justify-between p-2 rounded-lg border transition-all ${isBackCamera ? 'bg-indigo-50/50 border-indigo-100 shadow-sm' : 'bg-transparent border-transparent'}`}>
                              <div>
                                <div className={`text-[10px] ${isBackCamera ? 'font-black text-indigo-900' : 'font-medium text-slate-600'}`}>
                                  {isBackCamera && <Camera size={10} className="inline mr-1 mb-0.5" />}
                                  {p.spnName}
                                </div>
                                <div className="text-[9px] text-slate-400 font-medium opacity-70">Qty: {p.reqQty}</div>
                              </div>
                              {getStatusBadge(p.status, 'small')}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-5 align-top"><span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">Pickup Pending</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );

  const renderSummaryView = () => (
    <div className="min-h-screen bg-slate-50 pb-20 animate-in slide-in-from-bottom duration-300">
      <header className="bg-white border-b px-8 py-6 sticky top-0 z-30 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentPage('dashboard')} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors"><ArrowLeft size={24}/></button>
          <div><h1 className="text-2xl font-black text-slate-900 tracking-tight">Purchase Plan Summary</h1><p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Grouped by Vendor</p></div>
        </div>
        <button onClick={downloadPdf} disabled={isPdfGenerating} className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs flex items-center gap-2 hover:bg-emerald-700 shadow-lg transition-all active:scale-95">
          {isPdfGenerating ? <Loader className="w-4 h-4 animate-spin"/> : <Download className="w-4 h-4"/>} DOWNLOAD PDF
        </button>
      </header>
      <main className="max-w-7xl mx-auto px-8 mt-8 space-y-12 pb-12">
        <div className="bg-white p-8 rounded-3xl shadow-sm border grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><User size={12}/> Generated By</label><input type="text" value={generatedBy} onChange={e=>setGeneratedBy(e.target.value)} placeholder="Name..." className="w-full px-4 py-3 border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all"/></div>
          <div className="space-y-2"><label className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><UserCheck size={12}/> Assigned Agent</label><input type="text" value={assignedTo} onChange={e=>setAssignedTo(e.target.value)} placeholder="Agent name..." className="w-full px-4 py-3 border rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all"/></div>
        </div>
        {vendorGroupedData.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-dashed text-slate-400">No ready units available for procurement.</div>
        ) : vendorGroupedData.map((group) => (
          <section key={group.requestId} className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden mb-8">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div><h3 className="text-lg font-black tracking-tight">{group.vendorName}</h3><div className="text-[10px] text-white/50 font-bold uppercase tracking-widest mt-1">ID: {group.requestId} | {group.date}</div></div>
              <div className="text-right"><div className="text-[9px] uppercase font-black text-white/50 tracking-widest mb-1">Subtotal</div><div className="text-xl font-black">₹{group.partList.reduce((acc, curr) => acc + ((parseFloat(curr.finalPrice) || curr.estPrice) * curr.totalQty), 0).toLocaleString()}</div></div>
            </div>
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                <tr><th className="p-5 w-12 text-center">#</th><th>Part Details & IDs</th><th className="text-center">Qty</th><th className="text-right">Price</th><th className="bg-indigo-50/20 text-center text-indigo-600">Manual Price</th><th className="text-right p-5">Total</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {group.partList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-5 text-center font-bold text-slate-300">{idx + 1}</td>
                    <td className="py-4">
                      <div className="text-sm font-bold text-slate-800">{item.spnName}</div>
                      <div className="text-[10px] text-indigo-500 font-bold bg-indigo-50 px-2 py-1 rounded inline-block mt-1 uppercase">UICs: {item.uics.join(', ')}</div>
                    </td>
                    <td className="text-center"><span className="px-3 py-1 bg-slate-100 font-black rounded-lg text-xs">{item.totalQty}</span></td>
                    <td className="text-right text-xs text-slate-400 font-bold line-through">₹{item.estPrice.toLocaleString()}</td>
                    <td className="bg-indigo-50/10">
                       <div className="flex justify-center px-4"><input type="number" className="w-full max-w-[120px] px-2 py-1 text-sm border-b-2 border-indigo-200 bg-transparent font-black text-indigo-600 text-center outline-none focus:border-indigo-500 transition-all" value={item.finalPrice} onChange={(e) => handleGlobalUpdate(item.spnCode, { finalPrice: e.target.value })} /></div>
                    </td>
                    <td className="p-5 text-right font-black text-slate-900">₹{((parseFloat(item.finalPrice)||item.estPrice)*item.totalQty).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </main>
    </div>
  );

  return (
    <div className="bg-slate-50 min-h-screen font-sans">
      {currentPage === 'dashboard' ? renderDashboardView() : 
       currentPage === 'pickup_request' ? renderPickupRequestView() : 
       renderSummaryView()}

      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${modalData.isDraft ? 'bg-amber-100' : 'bg-indigo-100'}`}><AlertCircle className={`w-10 h-10 ${modalData.isDraft ? 'text-amber-600' : 'text-indigo-600'}`}/></div>
            <h2 className="text-2xl font-black mb-2 text-slate-900">{modalData.isDraft ? "Draft Mode" : "Ready to Process"}</h2>
            <p className="text-slate-500 mb-10 text-sm leading-relaxed font-medium">
               {modalData.isDraft 
                ? "No units are fully 'Ready'. Purchase Plan requires at least one unit with all parts available." 
                : `Found ${modalData.repairableCount} unit(s) fully ready for repair.`}
            </p>
            <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setShowConfirmModal(false)} className="py-4 font-black text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-2xl transition-all uppercase text-[10px] tracking-widest border border-slate-100">Cancel</button>
               <button onClick={() => {setShowConfirmModal(false); setShowSuccessModal(true);}} className="py-4 font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-xl shadow-indigo-100 transition-all uppercase text-[10px] tracking-widest">Proceed</button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-10 rounded-[40px] text-center max-w-sm w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="w-20 h-20 bg-emerald-100 rounded-full mx-auto mb-6 flex items-center justify-center animate-bounce"><Check className="w-10 h-10 text-emerald-600"/></div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">Success!</h3>
            <p className="text-slate-500 mb-12 font-medium">Procurement data aggregated by vendor and IDs generated.</p>
            <button onClick={() => {setShowSuccessModal(false); setCurrentPage('summary');}} className="w-full py-5 bg-slate-900 text-white rounded-3xl font-black flex items-center justify-center group tracking-widest text-[10px] uppercase shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all">
              OPEN SUMMARY <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform"/>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
