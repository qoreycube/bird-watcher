"use client";

export default function Index() {
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      await fetch('/api/birdsubmit', {
        method: 'POST',
        body: formData,
      });
    } catch (error) {
      console.error('Error submitting image:', error);
    }
  }
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
    </div>
  );
}
