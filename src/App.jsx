import { useState, useEffect, useRef } from "react";

function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [evolutions, setEvolutions] = useState([]);
  const [mainDetailImage, setMainDetailImage] = useState("");
  const [mainDetailName, setMainDetailName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);

  // CONTROL DE FLUJO ABSOLUTO CON REFS
  const offsetRef = useRef(0);
  const scrollPos = useRef(0);
  const loaderRef = useRef(null);
  const isFetching = useRef(false); // Candado síncrono infalible

  const fetchPokemon = async () => {
    // Si el candado está cerrado o estamos cargando, bloqueamos inmediatamente
    if (isFetching.current || loading) return;

    isFetching.current = true;
    setLoading(true);

    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/pokemon?limit=20&offset=${offsetRef.current}`,
      );

      if (!res.ok) throw new Error("Error en la respuesta de la API");

      const data = await res.json();

      const detailPromises = data.results.map(async (p) => {
        const r = await fetch(p.url);
        return await r.json();
      });

      const details = await Promise.all(detailPromises);

      setPokemonList((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        const unique = details.filter((p) => !ids.has(p.id));
        return [...prev, ...unique];
      });

      offsetRef.current += 20;
    } catch (error) {
      console.error("Error cargando Pokémon:", error);
    } finally {
      setLoading(false);
      // Pequeño retraso al liberar el candado para dar tiempo a que el DOM se dibuje
      setTimeout(() => {
        isFetching.current = false;
      }, 300);
    }
  };

  // 1. CARGA INICIAL
  useEffect(() => {
    fetchPokemon();
  }, []);

  // 2. INTERSECTION OBSERVER NATIVO (Sin librerías externas para evitar fallos de importación)
  useEffect(() => {
    if (selectedPokemon || searchResult) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Solo dispara si el elemento entra a la pantalla Y el candado está abierto
        if (entries[0].isIntersecting && !isFetching.current && !loading) {
          fetchPokemon();
        }
      },
      { threshold: 0.1 },
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [selectedPokemon, searchResult, loading]);

  // 3. RESTAURAR SCROLL VISTA ANTERIOR
  useEffect(() => {
    if (!selectedPokemon && scrollPos.current > 0) {
      setTimeout(() => {
        window.scrollTo(0, scrollPos.current);
      }, 30);
    }
  }, [selectedPokemon]);

  const handleSelect = async (pokemon) => {
    scrollPos.current = window.scrollY;
    setSelectedPokemon(pokemon);
    setMainDetailImage(pokemon.sprites.other["official-artwork"].front_default);
    setMainDetailName(pokemon.name);
    setEvolutions([]);

    try {
      const specRes = await fetch(
        `https://pokeapi.co/api/v2/pokemon-species/${pokemon.id}/`,
      );
      const specData = await specRes.json();
      const evoRes = await fetch(specData.evolution_chain.url);
      const evoData = await evoRes.json();

      const allEvolutions = [];

      const traverse = (node) => {
        const id = node.species.url.split("/")[6];
        allEvolutions.push({
          name: node.species.name,
          image: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`,
        });

        if (node.evolves_to.length > 0) {
          node.evolves_to.forEach((evolutionNode) => {
            traverse(evolutionNode);
          });
        }
      };

      traverse(evoData.chain);
      setEvolutions(allEvolutions);
    } catch (e) {
      console.error("Error en evoluciones:", e);
    }
  };

  const changeMainView = (evo) => {
    setMainDetailImage(evo.image);
    setMainDetailName(evo.name);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchTerm.trim()) {
      setSearchResult(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/pokemon/${searchTerm.toLowerCase().trim()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResult([data]);
      } else {
        setSearchResult([]);
      }
    } catch (error) {
      console.error("Error en la búsqueda:", error);
      setSearchResult([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSearchResult(null);
  };

  // --- RENDERS ---
  if (selectedPokemon) {
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={() => setSelectedPokemon(null)}>
          ←
        </button>
        <div>
          <img
            className="main-sprite"
            src={mainDetailImage}
            alt={mainDetailName}
          />
          <h1 style={{ textAlign: "center", textTransform: "capitalize" }}>
            {mainDetailName}
          </h1>
        </div>

        <div className="evolution-chain">
          {evolutions.map((evo, i) => (
            <div
              key={i}
              className="evo-item"
              onClick={() => changeMainView(evo)}
              style={{ cursor: "pointer" }}
            >
              <img src={evo.image} alt={evo.name} />
              <p style={{ textTransform: "capitalize" }}>{evo.name}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="app-container" style={{ minHeight: "100vh" }}>
      <header className="header">
        <h1>Pokédex</h1>
        <form
          onSubmit={handleSearch}
          style={{
            maxWidth: "400px",
            margin: "20px auto",
            display: "flex",
            gap: "10px",
            padding: "0 20px",
          }}
        >
          <input
            type="text"
            placeholder="Buscar Pokémon por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "25px",
              border: "1px solid #ccc",
              fontSize: "1rem",
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              padding: "12px 20px",
              borderRadius: "25px",
              border: "none",
              backgroundColor: "#ff1f1f",
              color: "white",
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            Buscar
          </button>
          {searchResult && (
            <button
              type="button"
              onClick={handleClearSearch}
              style={{
                padding: "12px",
                borderRadius: "25px",
                border: "1px solid #ff1f1f",
                backgroundColor: "transparent",
                color: "#ff1f1f",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              X
            </button>
          )}
        </form>
      </header>

      {searchResult && searchResult.length === 0 ? (
        <p
          style={{
            textAlign: "center",
            fontWeight: "bold",
            color: "#666",
            marginTop: "40px",
          }}
        >
          No se encontró ningún Pokémon con ese nombre.
        </p>
      ) : (
        <div className="grid">
          {(searchResult || pokemonList).map((pokemon, index) => (
            <div
              key={`${pokemon.id}-${index}`}
              className="card"
              onClick={() => handleSelect(pokemon)}
            >
              <span className="id-tag">
                #{pokemon.id.toString().padStart(3, "0")}
              </span>
              <img
                src={pokemon.sprites.other["official-artwork"].front_default}
                alt={pokemon.name}
              />
              <h2>{pokemon.name}</h2>
            </div>
          ))}
        </div>
      )}

      {!searchResult && (
        <div
          ref={loaderRef}
          className="loader"
          style={{
            textAlign: "center",
            padding: "20px",
            fontWeight: "bold",
            color: "#ff1f1f",
          }}
        >
          {loading ? "Cargando Pokémon..." : "Desliza para ver más"}
        </div>
      )}
    </div>
  );
}

export default App;
