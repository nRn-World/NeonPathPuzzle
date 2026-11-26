import { useState } from "react";

interface GrafikInställningarProps {
  // ...
}

const GrafikInställningar: React.FC<GrafikInställningarProps> = () => {
  const [variant, setVariant] = useState("scanlines");
  const [färg, setFärg] = useState("#00f3ff");
  const [textur, setTextur] = useState("neon");

  const handleVariantChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setVariant(event.target.value);
  };

  const handleFärgChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFärg(event.target.value);
  };

  const handleTexturChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setTextur(event.target.value);
  };

  return (
    <div>
      <label>
        Variant:
        <select value={variant} onChange={handleVariantChange}>
          <option value="scanlines">Scanlines</option>
          <option value="rain">Rain</option>
          {/* ... */}
        </select>
      </label>
      <label>
        Färg:
        <input type="color" value={färg} onChange={handleFärgChange} />
      </label>
      <label>
        Textur:
        <select value={textur} onChange={handleTexturChange}>
          <option value="neon">Neon</option>
          {/* ... */}
        </select>
      </label>
    </div>
  );
};

export default GrafikInställningar;
