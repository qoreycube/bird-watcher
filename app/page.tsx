"use client";

import { BirdPredictionResponse } from "@/types/bird-prediction-response";
import { SpeciesResponse } from "@/types/species-response";
import { useState, useEffect } from "react"; 

export default function Home() {
  const [result, setResult] = useState<BirdPredictionResponse | string | null>(null);
  const [species, setSpecies] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showSpecies, setShowSpecies] = useState(false);

  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const response = await fetch('/api/species');
        if (response.ok) {
          const data: SpeciesResponse = await response.json();
          setSpecies(data.species.sort());
        }
      } catch (error) {
        setSpecies([]);
      }
    };
    fetchSpecies();
  }, []);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append('image', file);
    try {
      const response = await fetch('/api/birdsubmit', {
        method: 'POST',
        body: formData,
      });
      if (response.ok) {
        const data = await response.json() as BirdPredictionResponse;
        setResult(data);
      } else {
        setResult('Failed to submit image.');
      }
    } catch (error) {
      setResult('Error submitting image: ' + String(error));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-gray-900 p-8">
      <div className="w-full max-w-[1280px] mx-auto flex flex-col items-center">
        <h1 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-white">Bird Watcher</h1>
        <p className="mb-6 text-lg text-gray-700 dark:text-gray-300 text-center max-w-2xl">
          Welcome to Bird Watcher! Upload a photo of a bird, and our AI will try to identify its species and tell you how confident it is in the prediction. Explore the list of species our model knows, and enjoy discovering more about the birds around you.
        </p>
        
        <form className="flex flex-col items-center gap-4 bg-gray-100 dark:bg-gray-800 p-6 rounded shadow-md">
          <label htmlFor="image-upload" className="text-lg font-medium text-gray-700 dark:text-gray-200">Select an image:</label>
          
          <input
            type="file"
            id="image-upload"
            name="image"
            accept="image/*"
            capture="environment"
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            onChange={handleImageChange}
          />
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Selected bird preview"
              className="mt-4 rounded shadow w-40 h-40 object-cover border border-gray-300 dark:border-gray-700"
            />
          )}
        </form>
        {result && typeof result === "string" &&  (
          <pre className="mt-6 p-4 bg-gray-200 dark:bg-gray-700 rounded text-sm w-full max-w-xl overflow-auto whitespace-pre-wrap break-words">There was an error predicting your bird species. Please try again later</pre>
        )}
        { result && typeof result === "object"  && (
          <pre className="mt-6 p-4 bg-gray-200 dark:bg-gray-700 rounded text-sm w-full max-w-xl overflow-auto whitespace-pre-wrap break-words">
            {`There is a ${(result.confidence * 100).toFixed(2)}% chance that your image was a ${result.predicted_species}.`}
          </pre>
        )}
        {species.length > 0 && (
          <div className="pt-8 w-full flex flex-col items-center">
            <button
              type="button"
              className="px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded shadow hover:bg-blue-200 dark:hover:bg-blue-800 font-medium mb-2"
              onClick={() => setShowSpecies((prev) => !prev)}
            >
              {`This model has been trained on ${species.length} species`}
              <span className="ml-2">{showSpecies ? "▲" : "▼"}</span>
            </button>
            <div
              className={`transition-all duration-500 ease-in-out overflow-hidden w-full max-w-xl ${showSpecies ? 'opacity-100' : 'opacity-0'}`}
              style={{
              marginTop: showSpecies ? '0.5rem' : '0',
              maxHeight: showSpecies ? 'none' : '0',
              height: showSpecies ? 'auto' : '0',
              }}
            >
              <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded text-sm w-full whitespace-pre-wrap break-words">
                <table className="hidden sm:block w-full text-left text-xs">
                <thead>
                <tr>
                  <th className="pb-2 font-semibold text-gray-700 dark:text-gray-200">Species Name</th>
                </tr>
                </thead>
                <tbody>
                {Array.from({ length: Math.ceil(species.length / 5) }).map((_, rowIdx) => (
                  <tr key={rowIdx} className="border-b border-gray-200 dark:border-gray-700">
                  {Array.from({ length: 5 }).map((_, colIdx) => {
                  const speciesIdx = rowIdx * 5 + colIdx;
                  return (
                  <td className="py-1 px-2" key={colIdx}>
                    {species[speciesIdx] || ""}
                  </td>
                  );
                  })}
                  </tr>
                ))}
                </tbody>
                </table>
                <div className="flex sm:hidden justify-center w-full">
                  <table className=" w-full max-w-xs text-left text-xs">
                  <thead>
                    <tr>
                    <th className="pb-2 font-semibold text-gray-700 dark:text-gray-200">Species Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: Math.ceil(species.length / 2) }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-b border-gray-200 dark:border-gray-700">
                      {Array.from({ length: 2 }).map((_, colIdx) => {
                      const speciesIdx = rowIdx * 2 + colIdx;
                      return (
                        <td className="py-1 px-2" key={colIdx}>
                        {species[speciesIdx] || ""}
                        </td>
                      );
                      })}
                    </tr>
                    ))}
                  </tbody>
                  </table>
                </div>

              </pre>
            </div>
          </div>
        )}
        <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400 max-w-[720px]">
          <p>
            <strong>Disclaimer:</strong> This AI-powered bird prediction is just for fun and guidance! Results may not be 100% accurate—after all, even the smartest birds get confused sometimes. Please use this tool as a helpful companion, not a definitive source. Happy bird watching!
          </p>
        </footer>
      </div>
    </div>
  );
}