"use client";

import { BirdPredictionResponse } from "@/types/bird-prediction-response";
import { SpeciesResponse } from "@/types/species-response";
import { useState, useEffect } from "react";

export default function Index() {
  const [result, setResult] = useState<BirdPredictionResponse | string | null>(null);
  const [species, setSpecies] = useState<string[]>([]);

  useEffect(() => {
    const fetchSpecies = async () => {
      try {
        const response = await fetch('/api/species');
        if (response.ok) {
          const data: SpeciesResponse = await response.json();
          setSpecies(data.species);
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
      <h1 className="text-4xl font-bold mb-8 text-center text-gray-900 dark:text-white">Bird Watcher</h1>
      <form className="flex flex-col items-center gap-4 bg-gray-100 dark:bg-gray-800 p-6 rounded shadow-md">
        <label htmlFor="image-upload" className="text-lg font-medium text-gray-700 dark:text-gray-200">Select an image:</label>
        <input
          type="file"
          id="image-upload"
          name="image"
          accept="image/*"
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          onChange={handleImageChange}
        />
      </form>
      {result && typeof result === "string" &&  (
        <pre className="mt-6 p-4 bg-gray-200 dark:bg-gray-700 rounded text-sm w-full max-w-xl overflow-auto">There was an error predicting your bird species. Please try again later</pre>
      )}
      { result && typeof result === "object"  && (
        <pre className="mt-6 p-4 bg-gray-200 dark:bg-gray-700 rounded text-sm w-full max-w-xl overflow-auto">
          {`There is a ${(result.confidence * 100).toFixed(2)}% chance that your image was a ${result.predicted_species}.`}
        </pre>
      )}
      {species.length > 0 && (
        <>
          <p className="pt-8">
            This model has been trained on the following bird species:
          </p>
          <pre className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded text-sm w-full max-w-xl whitespace-pre-wrap break-words">
            {species.join(", ")}
          </pre>
        </>
      )}

      <footer className="mt-12 text-center text-xs text-gray-500 dark:text-gray-400">
        <p>
          <strong>Disclaimer:</strong> This AI-powered bird prediction is just for fun and guidance! Results may not be 100% accurate—after all, even the smartest birds get confused sometimes. Please use this tool as a helpful companion, not a definitive source. Happy bird watching!
        </p>
      </footer>
    </div>
  );
}
