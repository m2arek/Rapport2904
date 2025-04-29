// script.js

/***************************************************
 * GESTION DES ONGLETS + AJUSTEMENT CARTE
 ***************************************************/
function openTab(evt, tabId) {
    const tabContents = document.getElementsByClassName("tabContent");
    for (let i = 0; i < tabContents.length; i++) {
      tabContents[i].classList.remove("activeTab");
    }
    const tablinks = document.getElementsByClassName("tablinks");
    for (let i = 0; i < tablinks.length; i++) {
      tablinks[i].classList.remove("activeTab");
    }
    document.getElementById(tabId).classList.add("activeTab");
    evt.currentTarget.classList.add("activeTab");
  
    if (tabId === 'tab1') {
      setTimeout(() => { map.invalidateSize(); }, 300);
    }
  }
  
  /***************************************************
   *  VARIABLES GLOBALES & DONNÉES PRIMES INTÉGRÉES
   ***************************************************/
  let monthlyProductionData = [];
  const primeTarifsData = {
    "France Metropolitaine": {
      "tarif_rachat": [
        { "min": 0, "max": 3, "tarif": 0.1269 },
        { "min": 4, "max": 9, "tarif": 0.1269 },
        { "min": 10, "max": 36, "tarif": 0.0761 },
        { "min": 37, "max": 100, "tarif": 0.0761 },
        { "min": 101, "max": 500, "tarif": 0.0761 }
      ],
      "primes": [
        { "min": 0, "max": 3, "montant_euros_par_wc": 0.22 },
        { "min": 4, "max": 9, "montant_euros_par_wc": 0.16 },
        { "min": 10, "max": 36, "montant_euros_par_wc": 0.19 },
        { "min": 37, "max": 100, "montant_euros_par_wc": 0.10 },
        { "min": 101, "max": 500, "montant_euros_par_wc": 0.10 }
      ]
    },
    "Corse": {
      "tarif_rachat": [
        { "min": 0, "max": 3, "tarif": 0.1641 },
        { "min": 4, "max": 9, "tarif": 0.1641 },
        { "min": 10, "max": 36, "tarif": 0.0891 },
        { "min": 37, "max": 100, "tarif": 0.0891 },
        { "min": 101, "max": 500, "tarif": 0.1335 }
      ],
      "primes": [
        { "min": 0, "max": 3, "montant_euros_par_wc": 1.26 },
        { "min": 4, "max": 9, "montant_euros_par_wc": 0.71 },
        { "min": 10, "max": 36, "montant_euros_par_wc": 0.36 },
        { "min": 37, "max": 100, "montant_euros_par_wc": 0.48 },
        { "min": 101, "max": 500, "montant_euros_par_wc": 0.00 }
      ]
    },
    "Reunion": {
      "tarif_rachat": [
        { "min": 0, "max": 3, "tarif": 0.1735 },
        { "min": 4, "max": 9, "tarif": 0.1735 },
        { "min": 10, "max": 36, "tarif": 0.0891 },
        { "min": 37, "max": 100, "tarif": 0.0891 },
        { "min": 101, "max": 500, "tarif": 0.1483 }
      ],
      "primes": [
        { "min": 0, "max": 3, "montant_euros_par_wc": 1.62 },
        { "min": 4, "max": 9, "montant_euros_par_wc": 0.97 },
        { "min": 10, "max": 36, "montant_euros_par_wc": 0.51 },
        { "min": 37, "max": 100, "montant_euros_par_wc": 0.39 },
        { "min": 101, "max": 500, "montant_euros_par_wc": 0.00 }
      ]
    }
  };
  
  function detectTerritoryFromZip(cpStr) {
    if (!cpStr || cpStr.length < 2) return "France Metropolitaine";
    let prefix2 = cpStr.substring(0, 2);
    if (prefix2 === "20") return "Corse";
    if (prefix2 === "97") return "Reunion";
    return "France Metropolitaine";
  }
  
  /***************************************************
   *  INITIALISATION PAGE
   ***************************************************/
  window.addEventListener("load", function() {
    const firstTabButton = document.querySelector(".tabNav button");
    if (firstTabButton) { firstTabButton.click(); }
    // Leasing selector logic
    document.getElementById("leasingCompany").addEventListener("change", function() {
      const ldInput = document.getElementById("leaseDuration");
      if (this.value === "Leasecom") {
        ldInput.value = 72;
        ldInput.disabled = true;
      } else {
        ldInput.disabled = false;
      }
    });
  
    // Build consumption table rows
    const consumptionTableBody = document.getElementById("consumptionTableBody");
    const months = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
    const lastRow = consumptionTableBody.querySelector("tr");
    months.forEach((month, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${month}</td>
        <td><input type="number" id="euros_${index}" placeholder="€" style="width:90%" oninput="calculateCost(${index})" /></td>
        <td><input type="number" id="kwh_${index}" placeholder="kWh" style="width:90%" oninput="calculateCost(${index})" /></td>
        <td id="costPerKwh_${index}">-</td>
      `;
      consumptionTableBody.insertBefore(row, lastRow);
    });
  });
  
  /***************************************************
   * 1) INITIALISER LA CARTE
   ***************************************************/
  const map = L.map("map").setView([48.8566, 2.3522], 18);
  L.tileLayer("https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
    maxZoom: 20,
    subdomains: ["mt0","mt1","mt2","mt3"],
    attribution: "© Google",
  }).addTo(map);
  let searchMarker = null;
  
  /***************************************************
   * 2) DESSIN LIBRE SUR CANVAS
   ***************************************************/
  const drawingCanvas = document.getElementById("drawingCanvas");
  const ctx = drawingCanvas.getContext("2d");
  let drawing = false, drawingEnabled = false;
  document.getElementById("toggleDrawingButton").addEventListener("click", () => {
    drawingEnabled = !drawingEnabled;
    drawingCanvas.style.pointerEvents = drawingEnabled ? "auto" : "none";
    document.getElementById("toggleDrawingButton").textContent = drawingEnabled
      ? "Désactiver le dessin"
      : "Activer le dessin (main levée)";
  });
  function resizeCanvas(){
    drawingCanvas.width = drawingCanvas.offsetWidth;
    drawingCanvas.height = drawingCanvas.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);
  drawingCanvas.addEventListener("mousedown", e=>{
    if(!drawingEnabled) return;
    drawing = true;
    ctx.beginPath();
    let r = drawingCanvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
    ctx.moveTo(x,y);
  });
  drawingCanvas.addEventListener("mouseup", ()=>{
    if(!drawingEnabled) return;
    drawing = false;
    ctx.beginPath();
  });
  drawingCanvas.addEventListener("mousemove", e=>{
    if(!drawing||!drawingEnabled) return;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "red";
    let r = drawingCanvas.getBoundingClientRect(),
        x = e.clientX - r.left,
        y = e.clientY - r.top;
    ctx.lineTo(x,y);
    ctx.stroke();
  });
  
  /***************************************************
   * A) OUTILS LEAFLET DRAW
   ***************************************************/
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);
  const drawControl = new L.Control.Draw({
    draw: { marker:false, circle:false, circlemarker:false, polygon:true, rectangle:true, polyline:true },
    edit: { featureGroup: drawnItems }
  });
  let measureActive = false;
  document.getElementById("toggleMeasureButton").addEventListener("click", ()=>{
    measureActive = !measureActive;
    if(measureActive){
      map.addControl(drawControl);
      document.getElementById("toggleMeasureButton").textContent = "Terminer la mesure";
    } else {
      map.removeControl(drawControl);
      document.getElementById("toggleMeasureButton").textContent = "Mesurer une surface";
    }
  });
  function computeBearing(lat1,lng1,lat2,lng2){
    const toRad = v=>v*Math.PI/180,
          toDeg = v=>v*180/Math.PI;
    let dLon = toRad(lng2-lng1),
        y = Math.sin(dLon)*Math.cos(toRad(lat2)),
        x = Math.cos(toRad(lat1))*Math.sin(toRad(lat2))
          - Math.sin(toRad(lat1))*Math.cos(toRad(lat2))*Math.cos(dLon);
    let brng = toDeg(Math.atan2(y,x));
    return (brng+360)%360;
  }
  map.on(L.Draw.Event.CREATED, e=>{
    const layer = e.layer;
    drawnItems.addLayer(layer);
    if(e.layerType==="polygon"||e.layerType==="rectangle"){
      let latLngs = layer.getLatLngs();
      if(Array.isArray(latLngs[0])) latLngs=latLngs[0];
      const area = L.GeometryUtil.geodesicArea(latLngs);
      const areaInt = Math.round(area);
      alert(`Surface mesurée : ${areaInt.toLocaleString('fr-FR')} m²`);
      document.getElementById("Surface toiture").value = areaInt;
      updateProductionPotential();
    } else if(e.layerType==="polyline"){
      let pts = layer.getLatLngs();
      if(pts.length<2){ alert("Tracez au moins 2 points pour l'orientation."); return; }
      let a = computeBearing(pts[0].lat,pts[0].lng, pts[pts.length-1].lat,pts[pts.length-1].lng);
      let aspectVal = ((a-180)+540)%360-180;
      document.getElementById("orientationIrr").value = aspectVal.toFixed(1);
      document.getElementById("orientation").value = aspectVal.toFixed(1);
      alert(`Orientation déterminée: ${aspectVal.toFixed(1)}° (0 = Sud)`);
      drawnItems.removeLayer(layer);
    }
  });
  
  /***************************************************
   * 3) RECHERCHE D'ADRESSE + MARQUEUR + TERRITOIRE
   ***************************************************/
  document.getElementById("addressSearchBtn").addEventListener("click", searchAddress);
  function searchAddress() {
    const address = document.getElementById("address").value;
    if(!address) return;
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
      .then(r=>r.json())
      .then(data=>{
        if(data.length>0){
          let {lat,lon} = data[0];
          map.setView([lat,lon],18);
          document.getElementById("Adresse").value = address;
          if(searchMarker) map.removeLayer(searchMarker);
          searchMarker = L.marker([lat,lon]).addTo(map)
            .bindPopup(`Adresse trouvée : ${address}`).openPopup();
          document.getElementById("latitudeIrr").value = lat;
          document.getElementById("longitudeIrr").value = lon;
          let cp = data[0].address?.postcode
                || (data[0].display_name.match(/\b(\d{4,5})\b/)||[])[1];
          document.getElementById("territory").value = detectTerritoryFromZip(cp);
        } else alert("Adresse introuvable.");
      })
      .catch(e=>{
        console.error("Erreur recherche adresse:", e);
        alert("Erreur lors de la recherche de l'adresse.");
      });
  }
  
  /***************************************************
   * 3B) CALCUL PRODUCTIBLE (API PVGIS)
   ***************************************************/
  async function getProductible(lat, lon, aspectValue) {
    const angleValue = parseFloat(document.getElementById("angleIrr").value)||35;
    const url = `https://re.jrc.ec.europa.eu/api/v5_2/PVcalc?outputformat=basic&lat=${lat}&lon=${lon}` +
      `&raddatabase=PVGIS-SARAH2&peakpower=1&loss=14&pvtechchoice=crystSi&angle=${angleValue}` +
      `&aspect=${aspectValue}&usehorizon=1`;
    const proxy = `https://corsproxy.io/?key=a32495b2&url=${encodeURIComponent(url)}`;
    try {
      let res = await fetch(proxy);
      if(!res.ok) return null;
      let txt = await res.text(), lines = txt.split("\n");
      let yearProd=null, tempMonthly=[];
      for(let line of lines){
        let cleanLine=line.trim();
        if(!cleanLine) continue;
        if(cleanLine.includes("Year")){
          let parts = cleanLine.split("\t").map(s=>s.trim());
          yearProd = parseFloat(parts[1]);
        } else if(/^\d+\s/.test(cleanLine)){
          let parts = cleanLine.split("\t").map(s=>s.trim());
          if(parts.length>=3){
            tempMonthly.push({month:+parts[0],E_m:+parts[2]});
          }
        }
      }
      monthlyProductionData = tempMonthly;
      return {yearProduction:yearProd,monthlyProduction:tempMonthly};
    } catch(e){ console.error(e); return null; }
  }
  document.getElementById("calculateIrrButton").addEventListener("click", async ()=>{
    let lat=parseFloat(document.getElementById("latitudeIrr").value),
        lon=parseFloat(document.getElementById("longitudeIrr").value);
    let aspect=parseFloat(document.getElementById("orientation").value);
    if(isNaN(lat)||isNaN(lon)){ alert("Renseignez lat/lon."); return; }
    let res=await getProductible(lat,lon,aspect);
    if(res?.yearProduction!=null){
      document.getElementById("productible").value = res.yearProduction.toLocaleString('fr-FR');
      fillMonthlyProductionTable(res.monthlyProduction);
    } else alert("Impossible de récupérer le productible.");
    updateProductionPotential();
  });
  function fillMonthlyProductionTable(monthlyData){
    const tbody = document.querySelector("#monthlyProductionTable tbody");
    tbody.innerHTML = "";
    const noms=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août",
                "Septembre","Octobre","Novembre","Décembre"];
    monthlyData.forEach(item=>{
      let row=document.createElement("tr"),
          idx=item.month-1,
          mCell=document.createElement("td"),
          pCell=document.createElement("td");
      mCell.textContent = noms[idx]||`Mois ${item.month}`;
      pCell.textContent = item.E_m?.toLocaleString('fr-FR')||"-";
      row.append(mCell,pCell);
      tbody.append(row);
    });
  }
  
  /***************************************************
   * 3C) CALCUL "POTENTIEL DE PRODUCTION"
   ***************************************************/
  function updateProductionPotential(){
    let surfStr=(document.getElementById("Surface toiture").value||"")
          .replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."),
        excl = parseFloat(document.getElementById("exclusionPercent").value)||0,
        panel = parseFloat(document.getElementById("puissancePanneau").value)||420,
        prodStr=(document.getElementById("productible").value||"")
          .replace(/\s/g,"").replace(/\./g,"").replace(/,/g,"."),
        surface=parseFloat(surfStr)||0,
        productible=parseFloat(prodStr)||0;
    let utile = surface*(1-excl/100),
        nbPanels=Math.floor(utile/2),
        puissanceMaxKW=Math.round(nbPanels*panel/1000),
        production=Math.round(puissanceMaxKW*productible);
    document.getElementById("nombrePVMax").value = nbPanels.toLocaleString('fr-FR');
    document.getElementById("puissanceMaxPV").value = puissanceMaxKW.toLocaleString('fr-FR');
    document.getElementById("productionInstall").value = production.toLocaleString('fr-FR');
  }
  ["Surface toiture","exclusionPercent","puissancePanneau","productible"]
    .forEach(id=>{
      const el=document.getElementById(id);
      el.addEventListener(id==="puissancePanneau"?"change":"input",updateProductionPotential);
    });
  
  /***************************************************
   * PARTIE : EXPORT  AVEC CAPTURE CARTE
   ***************************************************/
  let mapCaptureDataURL=null, mapCaptureFormat=null;
  document.getElementById("mapCaptureFile").addEventListener("change", e=>{
    const file=e.target.files[0];
    if(!file){ mapCaptureDataURL=null; return; }
    const reader=new FileReader();
    reader.onload=e2=>{
      mapCaptureDataURL=e2.target.result;
      mapCaptureFormat = file.type.toLowerCase().includes("jpeg")?"JPEG":"PNG";
      alert("Capture de carte sélectionnée !");
    };
    reader.readAsDataURL(file);
  });
  document.getElementById("exportPDFBtn").addEventListener("click", generatePdfReport);
  
  /***************************************************
   * MODULE : PLAN DE TRÉSORERIE (ONGLET 12)
   ***************************************************/
  function getGrenkeFactor(amountHT, months) {
    const baremeGrenke = [
      { min: 12501, max: 25000, factor60:2.07, factor72:null, factor84:null, factor96:null },
      { min: 25001, max: 37500, factor60:2.06, factor72:1.77, factor84:null, factor96:null },
      { min: 37501, max: 50000, factor60:2.05, factor72:1.76, factor84:1.56, factor96:null },
      { min: 50001, max: 75000, factor60:2.04, factor72:1.75, factor84:1.55, factor96:1.40 },
      { min: 75001, max:100500, factor60:2.03, factor72:1.74, factor84:1.54, factor96:1.39 },
      { min:100501, max:Infinity, factor60:2.02, factor72:1.73, factor84:1.53, factor96:1.38 }
    ];
    for(let b of baremeGrenke){
      if(amountHT>=b.min && amountHT<=b.max){
        switch(months){
          case 60: return b.factor60;
          case 72: return b.factor72;
          case 84: return b.factor84;
          case 96: return b.factor96;
        }
      }
    }
    return null;
  }
  
  function calculatePlanTresorerie(){
    const mode = document.getElementById("financementMode").value;
    const scenario = document.getElementById("scenarioPlan").value;
    // Update header label
    const headerRow = document.getElementById("planTresorerieHeader").querySelector("tr");
    headerRow.cells[2].innerHTML = mode==="leasing"?"Loyer":"Remboursement du prêt";
  
    let auto1, surplus1;
    if(scenario==="standard"){
      auto1 = parseFloat(document.getElementById("monthlyTotalAuto").textContent.replace(/[^0-9.-]/g,""))||0;
      surplus1 = parseFloat(document.getElementById("monthlyTotalRevente").textContent.replace(/[^0-9.-]/g,""))||0;
    } else {
      auto1 = parseFloat(document.getElementById("monthlyTotalAutoForced").textContent.replace(/[^0-9.-]/g,""))||0;
      surplus1 = parseFloat(document.getElementById("monthlyTotalReventeForced").textContent.replace(/[^0-9.-]/g,""))||0;
    }
    const recettesA1 = auto1 + surplus1;
  
    // installation cost HT
    let costHT = scenario==="standard"
      ? parseFloat(document.getElementById("coutInstallation").textContent.replace(/[^0-9.]/g,""))||0
      : parseFloat(document.getElementById("coutInstallationForced").textContent.replace(/[^0-9.]/g,""))||0;
    let remise = scenario==="standard"
      ? parseFloat(document.getElementById("remise").value)||0
      : parseFloat(document.getElementById("remiseForced").value)||0;
    costHT = Math.max(costHT - remise, 0);
  
    // power recommended
    let preconPower = scenario==="standard"
      ? parseFloat(document.getElementById("puissanceReco").textContent)||0
      : parseFloat(document.getElementById("puissanceRecoForced").textContent)||0;
  
    // financial params
    const inflation = parseFloat(document.getElementById("inflation_estimee").value)||0;
    const taux = parseFloat(document.getElementById("taux_emprunt").value)||0;
    const duree = parseFloat(document.getElementById("duree_pret").value)||0;
    const index_leasing = parseFloat(document.getElementById("index_leasing").value)||0;
    const duree_leasing = parseFloat(document.getElementById("duree_leasing").value)||0;
  
    let annualLoan=0, annualLeasing=0;
    if(mode==="banque" && duree>0){
      let n=duree*12, i=taux/100/12;
      let monthly = costHT*(i*Math.pow(1+i,n))/(Math.pow(1+i,n)-1);
      annualLoan = monthly*12;
    }
    if(mode==="leasing"){
      const lessor = document.getElementById("leasingCompany").value;
      if(lessor==="Leasecom"){
        annualLeasing = costHT*(index_leasing/100)*12;
      } else if(lessor==="Grenke"){
        let factor=getGrenkeFactor(costHT, parseInt(document.getElementById("leaseDuration").value)||0);
        if(factor==null){
          alert(`Durée non disponible pour montant ${costHT} €`);
        } else {
          annualLeasing = ((costHT*factor)/100)*12;
        }
      }
    }
  
    let totalRec=0, totalFin=0, totalNet=0;
    const tbody=document.getElementById("planTresorerieBody");
    tbody.innerHTML="";
    for(let year=1;year<=20;year++){
      let recettes = year===1 ? recettesA1 : (()=>{
        let rows = (scenario==="standard"
          ? document.querySelectorAll("#preconisationTable tbody tr")
          : document.querySelectorAll("#preconisationTableForced tbody tr")
        );
        if(rows.length>=year){
          let r=rows[year-1],
              econ=parseFloat(r.cells[2].textContent.replace(/[^0-9.-]/g,""))||0,
              rev=parseFloat(r.cells[4].textContent.replace(/[^0-9.-]/g,""))||0;
          let val = econ+rev;
          if(year===2){
            let S = scenario==="standard"
              ? parseFloat(document.getElementById("puissanceReco").textContent)||0
              : parseFloat(document.getElementById("puissanceRecoForced").textContent)||0;
            let territory = document.getElementById("territory").value;
            let tObj = getTarifRachatAndPrime(S, territory);
            let primeTotal = Math.round(tObj.primeByWc*(S*1000));
            val += primeTotal;
          }
          return val*Math.pow(1+inflation/100, year-1);
        }
        return recettesA1*Math.pow(1+inflation/100, year-1);
      })();
      let finCost = mode==="banque"
        ? ((year<=duree)?annualLoan:0)
        : ((year<=duree_leasing/12)?annualLeasing:0);
      let net = recettes - finCost;
      totalRec += recettes; totalFin += finCost; totalNet += net;
      let row=document.createElement("tr");
      row.innerHTML = `<td>${year}</td><td>${recettes.toFixed(2)} €</td>`+
        `<td>${finCost.toFixed(2)} €</td><td>${net.toFixed(2)} €</td>`;
      tbody.append(row);
    }
    let totRow=document.createElement("tr");
    totRow.innerHTML = `<th>Totaux</th><th>${totalRec.toFixed(2)} €</th>`+
      `<th>${totalFin.toFixed(2)} €</th><th>${totalNet.toFixed(2)} €</th>`;
    tbody.append(totRow);
  }
  document.getElementById("calculateTresorerieBtn").addEventListener("click", calculatePlanTresorerie);
  
  /***************************************************
   * 5) SAUVEGARDER / CHARGER JSON
   ***************************************************/
  document.getElementById("saveToFile").addEventListener("click", ()=>{
    const form = document.getElementById("userForm"),
          data = new FormData(form),
          obj = {};
    data.forEach((v,k)=>{
      if(obj[k]!==undefined){
        if(!Array.isArray(obj[k])) obj[k]=[obj[k]];
        obj[k].push(v);
      } else obj[k]=v;
    });
    const center=map.getCenter();
    obj.mapCenterLat=center.lat;
    obj.mapCenterLng=center.lng;
    obj.mapZoom=map.getZoom();
    obj.canvasImage=drawingCanvas.toDataURL();
    obj.drawnShapes=drawnItems.toGeoJSON();
    obj.monthlyProductionData=monthlyProductionData;
    const name=obj.companyName||"Formulaire";
    const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download=`Formulaire_${name}.json`;
    link.click();
  });
  document.getElementById("uploadFile").addEventListener("click", ()=>document.getElementById("loadFromFile").click());
  document.getElementById("loadFromFile").addEventListener("change", e=>{
    const file=e.target.files[0];
    if(!file) return;
    const reader=new FileReader();
    reader.onload=e2=>{
      const json=JSON.parse(e2.target.result),
            form=document.getElementById("userForm");
      Object.keys(json).forEach(k=>{
        if(["mapCenterLat","mapCenterLng","mapZoom","canvasImage","drawnShapes","monthlyProductionData"].includes(k)) return;
        let v=json[k];
        if(Array.isArray(v)){
          v.forEach(val=>{
            let cb=form.querySelector(`[name="${k}"][value="${val}"]`);
            if(cb) cb.checked=true;
          });
        } else {
          let inp=form.querySelector(`[name="${k}"]`);
          if(inp) inp.value=v;
        }
      });
      if(json.mapCenterLat!=null&&json.mapCenterLng!=null&&json.mapZoom!=null){
        map.setView([json.mapCenterLat,json.mapCenterLng], json.mapZoom);
      }
      if(json.canvasImage){
        let img=new Image();
        img.onload=()=>{
          ctx.clearRect(0,0,drawingCanvas.width,drawingCanvas.height);
          ctx.drawImage(img,0,0);
        };
        img.src=json.canvasImage;
      }
      if(json.drawnShapes){
        drawnItems.clearLayers();
        L.geoJson(json.drawnShapes).eachLayer(l=>drawnItems.addLayer(l));
      }
      if(json.monthlyProductionData){
        monthlyProductionData=json.monthlyProductionData;
        fillMonthlyProductionTable(monthlyProductionData);
      }
      for(let i=0;i<12;i++) calculateCost(i);
      updateProductionPotential();
    };
    reader.readAsText(file);
  });
  
  /***************************************************
   * 6) CALCUL DU COÛT PAR kWh
   ***************************************************/
  function calculateCost(index){
    const eurosInp=document.getElementById(`euros_${index}`),
          kwhInp=document.getElementById(`kwh_${index}`),
          costCell=document.getElementById(`costPerKwh_${index}`);
    let euros=parseFloat(eurosInp.value)||0,
        kwh=parseFloat(kwhInp.value)||0;
    if(kwh>0){
      costCell.textContent = `${(euros/kwh).toFixed(2)} €`;
    } else costCell.textContent="-";
    calculateTotals();
  }
  function calculateTotals(){
    let te=0, tk=0;
    for(let i=0;i<12;i++){
      let e=parseFloat(document.getElementById(`euros_${i}`).value)||0,
          k=parseFloat(document.getElementById(`kwh_${i}`).value)||0;
      te+=e; tk+=k;
    }
    const avg=tk>0?(te/tk).toFixed(2):"-";
    document.getElementById("totalEuros").textContent = te.toLocaleString('fr-FR', {minimumFractionDigits:2})+" €";
    document.getElementById("totalKwh").textContent  = tk.toLocaleString('fr-FR', {minimumFractionDigits:2})+" kWh";
    document.getElementById("totalCostPerKwh").textContent = avg!=="-"?`${avg} €`:"-";
  }
  
  /***************************************************
   * 7) CALCUL DE LA PRÉCONISATION
   ***************************************************/
  function costInstallation(S, territory){
    let raw = S<=100
      ? S*((1.9093-0.00659*S))*1000
      : S*1.15*1000;
    if(territory==="Corse") raw*=1.00;
    else if(territory==="Reunion") raw*=1.13;
    return Math.round(raw/100)*100;
  }
  function getClosedDaysFraction(){
    let closed=[];
    document.querySelectorAll('input[name="joursConges[]"]:checked')
      .forEach(chk=>closed.push(chk.value));
    return closed.length/7;
  }
  function getTarifRachatAndPrime(S, territory){
    const tData=primeTarifsData[territory]||primeTarifsData["France Metropolitaine"];
    let foundTarif=0.0761, foundPrime=0;
    tData.tarif_rachat.forEach(r=>{
      if(S>=r.min&&S<=r.max) foundTarif=r.tarif;
    });
    tData.primes.forEach(r=>{
      if(S>=r.min&&S<=r.max) foundPrime=r.montant_euros_par_wc;
    });
    return {tarif:foundTarif, primeByWc:foundPrime};
  }
  function calculateROI(coutInstallation, autoYear1, surplusYear1, primeTotal, annualPriceIncrease){
    let cum=0, years=0;
    while(years<100){
      years++;
      let econAuto=autoYear1*Math.pow(1+annualPriceIncrease/100,years-1),
          gainsRev=surplusYear1,
          prime=years===2?primeTotal:0;
      cum+=econAuto+gainsRev+prime;
      if(cum>=coutInstallation) break;
    }
    return years;
  }
  function computeAutoAndSurplusForPower(S, globalTarif){
    const ratioD=parseFloat(document.getElementById("ratioDiurne").value)||50,
          fractionClosed=getClosedDaysFraction();
    let totalGain=0;
    for(let i=0;i<12;i++){
      let consoKwh=parseFloat(document.getElementById(`kwh_${i}`).value)||0,
          p_kWh=parseFloat(document.getElementById(`costPerKwh_${i}`).textContent)||0,
          E_m1kW=monthlyProductionData[i]?.E_m||0,
          production=S*E_m1kW,
          forcedSurplus=fractionClosed*production,
          leftover=production-forcedSurplus,
          consoKwhDiurne=consoKwh*(ratioD/100),
          autoCons=Math.min(leftover,consoKwhDiurne),
          leftoverAfter=leftover-autoCons,
          finalSurplus=forcedSurplus+Math.max(leftoverAfter,0),
          gainMonth=autoCons*p_kWh;
      totalGain+=gainMonth;
    }
    return totalGain;
  }
  function calculatePreconisationWithPower(S, firstYearGain, territoryObj){
    fillMonthlyPreconisation(S, territoryObj.tarif);
    fill20YearsPreconisation(S, firstYearGain, territoryObj);
  }
  let monthlyBarChart=null;
  function createMonthlyBarChart(labels, consoData, autoData, revData){
    const ctx=document.getElementById("monthlyBarChart").getContext("2d");
    if(monthlyBarChart) monthlyBarChart.destroy();
    monthlyBarChart = new Chart(ctx,{
      type:"bar",
      data:{labels,datasets:[
        {label:"Conso kWh", data:consoData},
        {label:"Autoconso kWh", data:autoData},
        {label:"Revente kWh", data:revData}
      ]},
      options:{responsive:true,scales:{y:{beginAtZero:true,title:{display:true,text:"kWh"}}}}
    });
  }
  function fillMonthlyPreconisation(S, globalTarif){
    const showKwh=document.getElementById("showKwhColumns").checked;
    const table=document.getElementById("preconisationMonthlyTable");
    table.innerHTML="";
    let headerRow=`<tr><th>Mois</th>`+
      `${showKwh?'<th>Conso kWh</th>':''}`+
      `${showKwh?'<th>Production kWh</th>':''}`+
      `${showKwh?'<th>Autoconso kWh</th>':''}`+
      `${showKwh?'<th>Revente kWh</th>':''}`+
      `<th>Facture Sans Centrale</th>`+
      `<th>Économies Autoconso</th>`+
      `<th>Facture Avec Centrale</th>`+
      `<th>Gains Revente</th>`+
      `<th>Total Économies</th>`+
      `<th>% Auto prod</th>`+
      `<th>% Auto conso</th>`+
      `<th>% Revente</th></tr>`;
    const thead=document.createElement("thead");
    thead.innerHTML=headerRow; table.appendChild(thead);
    const tbody=document.createElement("tbody");
    table.appendChild(tbody);
    let footRow=`<tr><th>Totaux</th>`+
      `${showKwh?'<td id="monthlySumKwhConso">-</td>':''}`+
      `${showKwh?'<td id="monthlySumProduction">-</td>':''}`+
      `${showKwh?'<td id="monthlySumKwhAuto">-</td>':''}`+
      `${showKwh?'<td id="monthlySumKwhRevente">-</td>':''}`+
      `<td id="monthlyTotalSansPv">-</td>`+
      `<td id="monthlyTotalAuto">-</td>`+
      `<td id="monthlyTotalAvecPv">-</td>`+
      `<td id="monthlyTotalRevente">-</td>`+
      `<td id="monthlyTotalEconomies">-</td>`+
      `<td id="monthlyTotalAutoProdPerc">-</td>`+
      `<td id="monthlyTotalAutoConsoPerc">-</td>`+
      `<td id="monthlyTotalRevPerc">-</td></tr>`;
    const tfoot=document.createElement("tfoot");
    tfoot.innerHTML=footRow; table.appendChild(tfoot);
  
    let sumSansPv=0, sumAuto=0, sumRev=0, sumAvecPv=0, sumEco=0;
    let sumKwhConso=0, sumKwhAuto=0, sumKwhRev=0, sumProduction=0;
    const noms=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août",
                "Septembre","Octobre","Novembre","Décembre"];
    const fractionClosed=getClosedDaysFraction();
    const ratioD=parseFloat(document.getElementById("ratioDiurne").value)||50;
    const chartConso=[], chartAuto=[], chartRev=[];
  
    for(let i=0;i<12;i++){
      let factureSansPv=parseFloat(document.getElementById(`euros_${i}`).value)||0,
          consoKwh=parseFloat(document.getElementById(`kwh_${i}`).value)||0,
          costUnit=parseFloat(document.getElementById(`costPerKwh_${i}`).textContent)||0,
          E_m1kW=monthlyProductionData[i]?.E_m||0,
          production=S*E_m1kW,
          forcedSurplus=fractionClosed*production,
          leftover=production-forcedSurplus,
          consoKwhDiurne=consoKwh*(ratioD/100),
          autoCons=Math.min(leftover,consoKwhDiurne),
          leftoverAfter=leftover-autoCons,
          finalSurplus=forcedSurplus+Math.max(leftoverAfter,0),
          economies=autoCons*costUnit,
          revente=finalSurplus*globalTarif,
          totalEcoMonth=economies+revente,
          factureAvecPv=factureSansPv-economies;
  
      sumSansPv+=factureSansPv;
      sumAuto+=economies;
      sumRev+=revente;
      sumAvecPv+=factureAvecPv;
      sumEco+=totalEcoMonth;
      sumKwhConso+=consoKwh;
      sumKwhAuto+=autoCons;
      sumKwhRev+=finalSurplus;
      sumProduction+=production;
  
      let autoprodPerc=consoKwh>0?100*(autoCons/consoKwh):0;
      let percAutoConsoGlobal=production>0?100*(autoCons/production):0;
      let percReventeGlobal=production>0?100*(finalSurplus/production):0;
  
      let row=document.createElement("tr");
      let rowHTML=`<td>${noms[i]}</td>`;
      if(showKwh) rowHTML+=`<td>${consoKwh.toFixed(1)}</td><td>${production.toFixed(1)}</td>`+
                         `<td>${autoCons.toFixed(1)}</td><td>${finalSurplus.toFixed(1)}</td>`;
      rowHTML+=`<td>${factureSansPv.toFixed(2)} €</td>`+
               `<td>${economies.toFixed(2)} €</td>`+
               `<td>${factureAvecPv.toFixed(2)} €</td>`+
               `<td>${revente.toFixed(2)} €</td>`+
               `<td>${totalEcoMonth.toFixed(2)} €</td>`+
               `<td>${autoprodPerc.toFixed(1)}%</td>`+
               `<td>${percAutoConsoGlobal.toFixed(1)}%</td>`+
               `<td>${percReventeGlobal.toFixed(1)}%</td>`;
      row.innerHTML=rowHTML;
      tbody.append(row);
  
      chartConso.push(consoKwh);
      chartAuto.push(autoCons);
      chartRev.push(finalSurplus);
    }
  
    if(showKwh){
      document.getElementById("monthlySumKwhConso").textContent = sumKwhConso.toFixed(1);
      document.getElementById("monthlySumProduction").textContent = sumProduction.toFixed(1);
      document.getElementById("monthlySumKwhAuto").textContent = sumKwhAuto.toFixed(1);
      document.getElementById("monthlySumKwhRevente").textContent = sumKwhRev.toFixed(1);
    }
    document.getElementById("monthlyTotalSansPv").textContent = sumSansPv.toFixed(2)+" €";
    document.getElementById("monthlyTotalAuto").textContent = sumAuto.toFixed(2)+" €";
    document.getElementById("monthlyTotalAvecPv").textContent = sumAvecPv.toFixed(2)+" €";
    document.getElementById("monthlyTotalRevente").textContent = sumRev.toFixed(2)+" €";
    document.getElementById("monthlyTotalEconomies").textContent = sumEco.toFixed(2)+" €";
  
    let finalAutoProdPerc = sumKwhConso>0?100*(sumKwhAuto/sumKwhConso):0;
    let finalAutoConsoPerc = (sumKwhAuto+sumKwhRev)>0?100*(sumKwhAuto/(sumKwhAuto+sumKwhRev)):0;
    let finalRevPerc = (sumKwhAuto+sumKwhRev)>0?100*(sumKwhRev/(sumKwhAuto+sumKwhRev)):0;
  
    document.getElementById("monthlyTotalAutoProdPerc").textContent = finalAutoProdPerc.toFixed(1)+"%";
    document.getElementById("monthlyTotalAutoConsoPerc").textContent = finalAutoConsoPerc.toFixed(1)+"%";
    document.getElementById("monthlyTotalRevPerc").textContent = finalRevPerc.toFixed(1)+"%";
  
    createMonthlyBarChart(noms, chartConso, chartAuto, chartRev);
  }
  
  // **** Fonction standard 20 ans ****
  function fill20YearsPreconisation(S, firstYearGain, territoryObj){
    const annualPriceIncrease = parseFloat(document.getElementById("annualPriceIncrease").value)||5;
    let baseCost = parseFloat(document.getElementById("monthlyTotalSansPv").textContent.replace(/€/g,""))||0,
        auto1 = parseFloat(document.getElementById("monthlyTotalAuto").textContent.replace(/€/g,""))||0,
        rev1  = parseFloat(document.getElementById("monthlyTotalRevente").textContent.replace(/€/g,""))||0,
        primeTotal = Math.round((territoryObj.primeByWc||0)*S*1000);
  
    const tbody = document.querySelector("#preconisationTable tbody");
    tbody.innerHTML = "";
  
    let totalSansPv=0, totalAuto=0, totalRev=0, totalPrime=0, totalEco=0, cumEco=0;
  
    const territory = document.getElementById("territory").value;
    const costInst = costInstallation(S, territory);
    document.getElementById("coutInstallation").textContent = costInst.toLocaleString('fr-FR');
    document.getElementById("primeValue").textContent = primeTotal.toLocaleString('fr-FR');
  
    let remise = parseFloat(document.getElementById("remise").value)||0;
    let coutReel = Math.max(costInst - primeTotal - remise, 0);
    document.getElementById("coutReelInstallation").textContent = coutReel.toLocaleString('fr-FR');
  
    for(let year=1;year<=20;year++){
      let factureSansPv = baseCost * Math.pow(1+annualPriceIncrease/100, year-1);
      let econAuto = auto1 * Math.pow(1+annualPriceIncrease/100, year-1);
      let gainsRev = rev1;
      let primeYear = year===2?primeTotal:0;
      let totalEcos = econAuto + gainsRev + primeYear;
      let factureAvecPv = factureSansPv - econAuto;
  
      totalSansPv += factureSansPv;
      totalAuto += econAuto;
      totalRev += gainsRev;
      totalPrime += primeYear;
      totalEco += totalEcos;
      cumEco += totalEcos;
  
      let row=document.createElement("tr");
      row.innerHTML = `
        <td>${year}</td>
        <td>${factureSansPv.toFixed(2)} €</td>
        <td>${econAuto.toFixed(2)} €</td>
        <td>${factureAvecPv.toFixed(2)} €</td>
        <td>${gainsRev.toFixed(2)} €</td>
        <td>${primeYear.toFixed(2)} €</td>
        <td>${totalEcos.toFixed(2)} €</td>
        <td>${cumEco.toFixed(2)} €</td>
      `;
      tbody.append(row);
    }
  
    document.getElementById("totalSansPv").textContent = totalSansPv.toFixed(2)+" €";
    document.getElementById("totalAuto").textContent = totalAuto.toFixed(2)+" €";
    document.getElementById("totalRevente").textContent = totalRev.toFixed(2)+" €";
    document.getElementById("totalPrime").textContent = totalPrime.toFixed(2)+" €";
    document.getElementById("totalAvecPv").textContent = (totalSansPv-totalAuto).toFixed(2)+" €";
    document.getElementById("totalEconomies").textContent = totalEco.toFixed(2)+" €";
    document.getElementById("puissanceReco").textContent = S.toLocaleString('fr-FR');
  
    const panelPower = parseFloat(document.getElementById("puissancePanneau").value)||420;
    const nombreModules = Math.round(S*1000/panelPower);
    const surfaceInstallation = nombreModules*2;
    document.getElementById("nombreModules").textContent = nombreModules.toLocaleString('fr-FR');
    document.getElementById("surfaceInstallation").textContent = surfaceInstallation.toLocaleString('fr-FR');
  
    document.getElementById("gainSansInv").textContent = totalEco.toFixed(2);
    document.getElementById("gainAvecInv").textContent = (totalEco - coutReel).toFixed(2);
  
    document.getElementById("roiResult").textContent = calculateROI(coutReel, auto1, rev1, primeTotal, annualPriceIncrease).toFixed(1);
  }
  
  // **** Fonction Sélection 20 ans ****
  function fill20YearsPreconisationForced(S, firstYearGain, territoryObj){
    const annualPriceIncrease = parseFloat(document.getElementById("annualPriceIncrease").value)||5;
    let baseCost = parseFloat(document.getElementById("monthlyTotalSansPvForced").textContent.replace(/€/g,""))||0,
        auto1 = parseFloat(document.getElementById("monthlyTotalAutoForced").textContent.replace(/€/g,""))||0,
        rev1  = parseFloat(document.getElementById("monthlyTotalReventeForced").textContent.replace(/€/g,""))||0,
        primeTotal = Math.round((territoryObj.primeByWc||0)*S*1000);
  
    const tbody = document.querySelector("#preconisationTableForced tbody");
    tbody.innerHTML = "";
  
    let totalSansPv=0, totalAuto=0, totalRev=0, totalPrime=0, totalEco=0, cumEco=0;
  
    const territory = document.getElementById("territory").value;
    const forcedCost = costInstallation(S, territory);
    document.getElementById("coutInstallationForced").textContent = forcedCost.toLocaleString('fr-FR');
    document.getElementById("primeValueForced").textContent = primeTotal.toLocaleString('fr-FR');
  
    let remiseForced = parseFloat(document.getElementById("remiseForced").value)||0;
    let coutReel = Math.max(forcedCost - primeTotal - remiseForced, 0);
    document.getElementById("coutReelInstallationForced").textContent = coutReel.toLocaleString('fr-FR');
  
    for(let year=1;year<=20;year++){
      let factureSansPv = baseCost * Math.pow(1+annualPriceIncrease/100, year-1);
      let econAuto = auto1 * Math.pow(1+annualPriceIncrease/100, year-1);
      let gainsRev = rev1;
      let primeYear = year===2?primeTotal:0;
      let totalEcos = econAuto + gainsRev + primeYear;
      let factureAvecPv = factureSansPv - econAuto;
  
      totalSansPv += factureSansPv;
      totalAuto += econAuto;
      totalRev += gainsRev;
      totalPrime += primeYear;
      totalEco += totalEcos;
      cumEco += totalEcos;
  
      let row=document.createElement("tr");
      row.innerHTML = `
        <td>${year}</td>
        <td>${factureSansPv.toFixed(2)} €</td>
        <td>${econAuto.toFixed(2)} €</td>
        <td>${factureAvecPv.toFixed(2)} €</td>
        <td>${gainsRev.toFixed(2)} €</td>
        <td>${primeYear.toFixed(2)} €</td>
        <td>${totalEcos.toFixed(2)} €</td>
        <td>${cumEco.toFixed(2)} €</td>
      `;
      tbody.append(row);
    }
  
    document.getElementById("totalSansPvForced").textContent = totalSansPv.toFixed(2)+" €";
    document.getElementById("totalAutoForced").textContent = totalAuto.toFixed(2)+" €";
    document.getElementById("totalReventeForced").textContent = totalRev.toFixed(2)+" €";
    document.getElementById("totalPrimeForced").textContent = totalPrime.toFixed(2)+" €";
    document.getElementById("totalAvecPvForced").textContent = (totalSansPv-totalAuto).toFixed(2)+" €";
    document.getElementById("totalEconomiesForced").textContent = totalEco.toFixed(2)+" €";
    document.getElementById("puissanceRecoForced").textContent = S.toLocaleString('fr-FR');
  
    const panelPower = parseFloat(document.getElementById("puissancePanneau").value)||420;
    const nombreModulesForced = Math.round(S*1000/panelPower);
    const surfaceInstallationForced = nombreModulesForced*2;
    document.getElementById("nombreModulesForced").textContent = nombreModulesForced.toLocaleString('fr-FR');
    document.getElementById("surfaceInstallationForced").textContent = surfaceInstallationForced.toLocaleString('fr-FR');
  
    document.getElementById("gainSansInvForced").textContent = totalEco.toFixed(2);
    document.getElementById("gainAvecInvForced").textContent = (totalEco - coutReel).toFixed(2);
  
    document.getElementById("roiResultForced").textContent = calculateROI(coutReel, auto1, rev1, primeTotal, annualPriceIncrease).toFixed(1);
  }
  
  document.getElementById("calculatePreconisation").addEventListener("click", ()=>{
    const territory = document.getElementById("territory").value;
    let maxPower = parseFloat((document.getElementById("puissanceMaxPV").value||"0").replace(/\s/g,""))||0;
    if(maxPower<=0){ alert("Puissance max PV non définie."); return; }
    let bestS=1, bestGain=0, bestTObj={tarif:0.0761,primeByWc:0};
    for(let s=1;s<=maxPower;s++){
      let tObj=getTarifRachatAndPrime(s, territory);
      let gain=computeAutoAndSurplusForPower(s,tObj.tarif);
      if(gain>bestGain){ bestGain=gain; bestS=s; bestTObj=tObj; }
    }
    calculatePreconisationWithPower(bestS, bestGain, bestTObj);
    document.getElementById("tarifRachat").value = bestTObj.tarif.toFixed(4);
  });
  
  let monthlyBarChartForced=null;
  function createMonthlyBarChartForced(labels, consoData, autoData, revData){
    const ctx=document.getElementById("monthlyBarChartForced").getContext("2d");
    if(monthlyBarChartForced) monthlyBarChartForced.destroy();
    monthlyBarChartForced = new Chart(ctx,{
      type:"bar",
      data:{labels,datasets:[
        {label:"Conso kWh", data:consoData},
        {label:"Autoconso kWh", data:autoData},
        {label:"Revente kWh", data:revData}
      ]},
      options:{responsive:true,scales:{y:{beginAtZero:true,title:{display:true,text:"kWh"}}}}
    });
  }
  function fillMonthlyPreconisationForced(S, globalTarif){
    const showKwh=document.getElementById("showKwhColumns").checked;
    const table=document.getElementById("preconisationMonthlyTableForced");
    table.innerHTML="";
    let headerRow=`<tr><th>Mois</th>`+
      `${showKwh?'<th>Conso kWh</th>':''}`+
      `${showKwh?'<th>Production kWh</th>':''}`+
      `${showKwh?'<th>Autoconso kWh</th>':''}`+
      `${showKwh?'<th>Revente kWh</th>':''}`+
      `<th>Facture Sans Centrale</th>`+
      `<th>Économies Autoconso</th>`+
      `<th>Facture Avec Centrale</th>`+
      `<th>Gains Revente</th>`+
      `<th>Total Économies</th>`+
      `<th>% Auto prod</th>`+
      `<th>% Auto conso</th>`+
      `<th>% Revente</th></tr>`;
    const thead=document.createElement("thead");
    thead.innerHTML=headerRow; table.appendChild(thead);
    const tbody=document.createElement("tbody");
    table.appendChild(tbody);
    let footRow=`<tr><th>Totaux</th>`+
      `${showKwh?'<td id="monthlySumKwhConsoForced">-</td>':''}`+
      `${showKwh?'<td id="monthlySumProductionForced">-</td>':''}`+
      `${showKwh?'<td id="monthlySumKwhAutoForced">-</td>':''}`+
      `${showKwh?'<td id="monthlySumKwhReventeForced">-</td>':''}`+
      `<td id="monthlyTotalSansPvForced">-</td>`+
      `<td id="monthlyTotalAutoForced">-</td>`+
      `<td id="monthlyTotalAvecPvForced">-</td>`+
      `<td id="monthlyTotalReventeForced">-</td>`+
      `<td id="monthlyTotalEconomiesForced">-</td>`+
      `<td id="monthlyTotalAutoProdPercForced">-</td>`+
      `<td id="monthlyTotalAutoConsoPercForced">-</td>`+
      `<td id="monthlyTotalRevPercForced">-</td></tr>`;
    const tfoot=document.createElement("tfoot");
    tfoot.innerHTML=footRow; table.appendChild(tfoot);
  
    let sumSansPv=0,sumAuto=0,sumRev=0,sumAvecPv=0,sumEco=0;
    let sumKwhConso=0,sumKwhAuto=0,sumKwhRev=0,sumProd=0;
    const noms=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août",
                "Septembre","Octobre","Novembre","Décembre"];
    const chartConso=[], chartAuto=[], chartRev=[];
    const fractionClosed=getClosedDaysFraction();
    const ratioD=parseFloat(document.getElementById("ratioDiurne").value)||50;
  
    for(let i=0;i<12;i++){
      let factureSansPv=parseFloat(document.getElementById(`euros_${i}`).value)||0,
          consoKwh=parseFloat(document.getElementById(`kwh_${i}`).value)||0,
          costUnit=parseFloat(document.getElementById(`costPerKwh_${i}`).textContent)||0,
          E_m1kW=monthlyProductionData[i]?.E_m||0,
          production=S*E_m1kW,
          forcedSurplus=fractionClosed*production,
          leftover=production-forcedSurplus,
          consoKwhDiurne=consoKwh*(ratioD/100),
          autoCons=Math.min(leftover,consoKwhDiurne),
          leftoverAfter=leftover-autoCons,
          finalSurplus=forcedSurplus+Math.max(leftoverAfter,0),
          economies=autoCons*costUnit,
          revente=finalSurplus*globalTarif,
          totalEcoMonth=economies+revente,
          factureAvecPv=factureSansPv-economies;
  
      sumSansPv+=factureSansPv;
      sumAuto+=economies;
      sumRev+=revente;
      sumAvecPv+=factureAvecPv;
      sumEco+=totalEcoMonth;
      sumKwhConso+=consoKwh;
      sumKwhAuto+=autoCons;
      sumKwhRev+=finalSurplus;
      sumProd+=production;
  
      let autoprodPerc=consoKwh>0?100*(autoCons/consoKwh):0;
      let percAutoConsoGlobal=production>0?100*(autoCons/production):0;
      let percReventeGlobal=production>0?100*(finalSurplus/production):0;
  
      let row=document.createElement("tr");
      let rowHTML=`<td>${noms[i]}</td>`;
      if(showKwh) rowHTML+=`<td>${consoKwh.toFixed(1)}</td><td>${production.toFixed(1)}</td>`+
                         `<td>${autoCons.toFixed(1)}</td><td>${finalSurplus.toFixed(1)}</td>`;
      rowHTML+=`<td>${factureSansPv.toFixed(2)} €</td>`+
               `<td>${economies.toFixed(2)} €</td>`+
               `<td>${factureAvecPv.toFixed(2)} €</td>`+
               `<td>${revente.toFixed(2)} €</td>`+
               `<td>${totalEcoMonth.toFixed(2)} €</td>`+
               `<td>${autoprodPerc.toFixed(1)}%</td>`+
               `<td>${percAutoConsoGlobal.toFixed(1)}%</td>`+
               `<td>${percReventeGlobal.toFixed(1)}%</td>`;
      row.innerHTML=rowHTML;
      tbody.append(row);
  
      chartConso.push(consoKwh);
      chartAuto.push(autoCons);
      chartRev.push(finalSurplus);
    }
  
    if(showKwh){
      document.getElementById("monthlySumKwhConsoForced").textContent = sumKwhConso.toFixed(1);
      document.getElementById("monthlySumProductionForced").textContent = sumProd.toFixed(1);
      document.getElementById("monthlySumKwhAutoForced").textContent = sumKwhAuto.toFixed(1);
      document.getElementById("monthlySumKwhReventeForced").textContent = sumKwhRev.toFixed(1);
    }
    document.getElementById("monthlyTotalSansPvForced").textContent = sumSansPv.toFixed(2)+" €";
    document.getElementById("monthlyTotalAutoForced").textContent = sumAuto.toFixed(2)+" €";
    document.getElementById("monthlyTotalAvecPvForced").textContent = sumAvecPv.toFixed(2)+" €";
    document.getElementById("monthlyTotalReventeForced").textContent = sumRev.toFixed(2)+" €";
    document.getElementById("monthlyTotalEconomiesForced").textContent = sumEco.toFixed(2)+" €";
  
    let finalAutoProdPercForced = sumKwhConso>0?100*(sumKwhAuto/sumKwhConso):0;
    let finalAutoConsoPercForced = (sumKwhAuto+sumKwhRev)>0?100*(sumKwhAuto/(sumKwhAuto+sumKwhRev)):0;
    let finalRevPercForced = (sumKwhAuto+sumKwhRev)>0?100*(sumKwhRev/(sumKwhAuto+sumKwhRev)):0;
  
    document.getElementById("monthlyTotalAutoProdPercForced").textContent = finalAutoProdPercForced.toFixed(1)+"%";
    document.getElementById("monthlyTotalAutoConsoPercForced").textContent = finalAutoConsoPercForced.toFixed(1)+"%";
    document.getElementById("monthlyTotalRevPercForced").textContent = finalRevPercForced.toFixed(1)+"%";
  
    createMonthlyBarChartForced(noms, chartConso, chartAuto, chartRev);
  }
  
  document.getElementById("applyForcedPreconisationBtn").addEventListener("click", ()=>{
    const territory = document.getElementById("territory").value;
    let S = parseFloat(document.getElementById("forcedPower").value);
    if(isNaN(S)||S<=0){ alert("Valeur > 0 requise."); return; }
    let tObj = getTarifRachatAndPrime(S, territory),
        gain = computeAutoAndSurplusForPower(S, tObj.tarif);
    fillMonthlyPreconisationForced(S, tObj.tarif);
    fill20YearsPreconisationForced(S, gain, tObj);
  });
  
  flatpickr("#rdvDate", { locale:"fr", dateFormat:"d/m/Y" });
  
  /***************************************************
   * FONCTION DE GÉNÉRATION DU RAPPORT PDF (5 pages)...
   ***************************************************/
  async function generatePdfReport() {
    let choix = prompt("Tapez 1 pour Sélection, 2 pour Standard", "2"),
        reportType = choix==="1"?"selection":"standard";
  
    let monthlyTableId = reportType==="selection"
          ? "preconisationMonthlyTableForced"
          : "preconisationMonthlyTable",
        projectionTableId = reportType==="selection"
          ? "preconisationTableForced"
          : "preconisationTable",
        chartId = reportType==="selection"
          ? "monthlyBarChartForced"
          : "monthlyBarChart";
  
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p","mm","a4");
    const pw = pdf.internal.pageSize.getWidth(),
          ph = pdf.internal.pageSize.getHeight();
  
    // ... Implementation for pages 1 to 5 with template merge ...
    // (Omitted here for brevity: same as in your original HTML script.)
  
    // At the end, save or merge template.
  }
  
  /***************************************************
   * BATCH EXPORT PDF – Paysage, de S=10 à Smax...
   ***************************************************/
  document.getElementById('batchReportBtn').addEventListener('click', ()=>{
    const maxPower = parseFloat(
      document.getElementById('puissanceMaxPV').value.replace(/\s|,/g,'')
    )||0;
  
    const clean = str=>(str||'').replace(/[\s\u00A0\u202F\/]/g,'').trim();
    const targetRate = parseFloat(document.getElementById('tauxAutoproduction').value)||0;
    let chosenSForAutoprod = null;
  
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('l','mm','a4');
    const headers = [
      'S (kWc)','Conso kWh','Production kWh','Autoconso kWh','Revente kWh',
      'Facture Sans Centrale','Économies Autoconso','Facture Avec Centrale',
      'Gains Revente','Total Économies','% Auto prod','% Auto conso','% Revente',
      'Prime (€)','Remise (€)','Coût inst. (€)','Coût net (€)',
      'Gain brut (€)','Gain net (€)','ROI (ans)'
    ];
    const body=[];
  
    for(let S=10;S<=maxPower;S++){
      document.getElementById('showKwhColumns').checked=true;
      document.getElementById('forcedPower').value=S;
      document.getElementById('applyForcedPreconisationBtn').click();
  
      const conso    = clean(document.getElementById('monthlySumKwhConsoForced')?.textContent||'-');
      const prod     = clean(document.getElementById('monthlySumProductionForced')?.textContent||'-');
      const autoKwh  = clean(document.getElementById('monthlySumKwhAutoForced')?.textContent||'-');
      const revKwh   = clean(document.getElementById('monthlySumKwhReventeForced')?.textContent||'-');
      const sansPv   = clean(document.getElementById('totalSansPvForced').textContent);
      const ecoAuto  = clean(document.getElementById('totalAutoForced').textContent);
      const avecPv   = clean(document.getElementById('totalAvecPvForced').textContent);
      const gainsRev = clean(document.getElementById('totalReventeForced').textContent);
      const totalEco = clean(document.getElementById('totalEconomiesForced').textContent);
  
      const pctProd  = clean(document.getElementById('monthlyTotalAutoProdPercForced').textContent);
      const pctConso = clean(document.getElementById('monthlyTotalAutoConsoPercForced').textContent);
      const pctRev   = clean(document.getElementById('monthlyTotalRevPercForced').textContent);
  
      const prime    = clean(document.getElementById('primeValueForced').textContent);
      const remise   = clean(document.getElementById('remiseForced').value);
      const costInst = clean(document.getElementById('coutInstallationForced').textContent);
      const costNet  = clean(document.getElementById('coutReelInstallationForced').textContent);
      const gainBrut = clean(document.getElementById('gainSansInvForced').textContent);
      const gainNet  = clean(document.getElementById('gainAvecInvForced').textContent);
      const roi      = clean(document.getElementById('roiResultForced').textContent);
  
      const currentPct = parseFloat(pctProd)||0;
      if(chosenSForAutoprod===null && currentPct>=targetRate){
        chosenSForAutoprod=S;
      }
  
      body.push([
        S.toFixed(1), conso, prod, autoKwh, revKwh,
        sansPv, ecoAuto, avecPv, gainsRev, totalEco,
        pctProd, pctConso, pctRev,
        prime, remise, costInst, costNet, gainBrut, gainNet, roi
      ]);
    }
  
    if(chosenSForAutoprod!==null){
      document.getElementById('puissanceAutoprodChoisie').textContent = chosenSForAutoprod.toFixed(1);
    }
  
    pdf.autoTable({
      head:[headers],
      body:body,
      startY:20,
      margin:{left:10,right:10},
      styles:{fontSize:6,cellPadding:1},
      headStyles:{fillColor:[22,160,133],textColor:255}
    });
  
    pdf.save('Rapport_multi_puissances.pdf');
    const autoprod = document.getElementById('puissanceAutoprodChoisie').textContent;
    document.getElementById('forcedPower').value = autoprod;
    document.getElementById('applyForcedPreconisationBtn').click();
  });
  