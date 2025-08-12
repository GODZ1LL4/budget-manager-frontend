import ScenarioManager from "../components/ScenarioManager";

function Scenarios({ token }) {
  return (
    <div className="max-w-5xl mx-auto mt-6 px-4">
      <ScenarioManager token={token} />
    </div>
  );
}

export default Scenarios;
